import { and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { milestones, projectMembers, projects, taskComments, tasks, users } from "@/db/schema";
import type { Priority, TaskStatus } from "@/db/schema/enums";
import { nn } from "@/lib/validations/common";
import type { taskSchema, updateTaskSchema } from "@/lib/validations/entities";
import { assertManager, assertStaff, isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { likePattern } from "./clients";
import { notify } from "./notifications";
import { recalcProjectProgress } from "./projects";
import { assertActiveStaff } from "./team";

export const OPEN_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED"];

export type TaskFilters = { q?: string; status?: TaskStatus; assigneeId?: string; priority?: Priority };

const taskColumns = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  startDate: tasks.startDate,
  estimatedHours: tasks.estimatedHours,
  position: tasks.position,
  projectId: tasks.projectId,
  milestoneId: tasks.milestoneId,
  parentTaskId: tasks.parentTaskId,
  assigneeId: tasks.assigneeId,
  assigneeName: users.fullName,
  completedAt: tasks.completedAt,
  updatedAt: tasks.updatedAt,
};

function filterWhere(f: TaskFilters) {
  return [
    f.status ? eq(tasks.status, f.status) : undefined,
    f.priority ? eq(tasks.priority, f.priority) : undefined,
    f.assigneeId ? eq(tasks.assigneeId, f.assigneeId) : undefined,
    f.q ? ilike(tasks.title, likePattern(f.q)) : undefined,
  ];
}

export async function listProjectTasks(db: DbOrTx, ctx: AuthContext, projectId: string, filters: TaskFilters = {}) {
  assertStaff(ctx);
  await getAccessibleProject(db, ctx, projectId);
  const rows = await db
    .select({ ...taskColumns, subtaskCount: sql<number>`(select count(*)::int from tasks s where s.parent_task_id = ${tasks.id} and s.archived_at is null)` })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, ctx.orgId), isNull(tasks.archivedAt), ...filterWhere(filters)))
    .orderBy(asc(tasks.position), desc(tasks.createdAt))
    .limit(500);
  return rows;
}

/** Tasks assigned to the current user across their projects. */
export async function listMyTasks(db: DbOrTx, ctx: AuthContext, filters: TaskFilters & { includeDone?: boolean } = {}) {
  assertStaff(ctx);
  return db
    .select({ ...taskColumns, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(
      and(
        eq(tasks.organizationId, ctx.orgId),
        eq(tasks.assigneeId, ctx.userId),
        isNull(tasks.archivedAt),
        isNull(projects.archivedAt),
        filters.includeDone || filters.status ? undefined : inArray(tasks.status, OPEN_STATUSES),
        ...filterWhere(filters),
      ),
    )
    .orderBy(sql`${tasks.dueDate} asc nulls last`, desc(tasks.updatedAt))
    .limit(300);
}

/** Loads a task the user may see (via project access). */
export async function getAccessibleTask(db: DbOrTx, ctx: AuthContext, taskId: string) {
  assertStaff(ctx);
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, ctx.orgId), isNull(tasks.archivedAt)))
    .limit(1);
  if (!task) throw new NotFoundError("Task not found.");
  const project = await getAccessibleProject(db, ctx, task.projectId);
  return { task, project };
}

export async function getTaskDetail(db: DbOrTx, ctx: AuthContext, taskId: string) {
  const { task, project } = await getAccessibleTask(db, ctx, taskId);
  const [assignee, subtasks, comments] = await Promise.all([
    task.assigneeId
      ? db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.id, task.assigneeId)).then((r) => r[0] ?? null)
      : null,
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, assigneeId: tasks.assigneeId })
      .from(tasks)
      .where(and(eq(tasks.parentTaskId, task.id), isNull(tasks.archivedAt)))
      .orderBy(asc(tasks.createdAt)),
    db
      .select({ id: taskComments.id, body: taskComments.body, createdAt: taskComments.createdAt, authorId: users.id, authorName: users.fullName })
      .from(taskComments)
      .leftJoin(users, eq(users.id, taskComments.authorId))
      .where(and(eq(taskComments.taskId, task.id), isNull(taskComments.deletedAt)))
      .orderBy(asc(taskComments.createdAt))
      .limit(200),
  ]);
  return { task, project: { id: project.id, name: project.name }, assignee, subtasks, comments };
}

async function validateRelations(
  db: DbOrTx,
  ctx: AuthContext,
  projectId: string,
  input: { milestoneId: string; assigneeId: string; parentTaskId?: string },
) {
  if (input.milestoneId) {
    const [m] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.id, input.milestoneId), eq(milestones.projectId, projectId), isNull(milestones.deletedAt)))
      .limit(1);
    if (!m) throw new BadRequestError("Milestone does not belong to this project.");
  }
  if (input.parentTaskId) {
    const [p] = await db
      .select({ id: tasks.id, parent: tasks.parentTaskId })
      .from(tasks)
      .where(and(eq(tasks.id, input.parentTaskId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
      .limit(1);
    if (!p) throw new BadRequestError("Parent task does not belong to this project.");
    if (p.parent) throw new BadRequestError("Subtasks can't have their own subtasks.");
  }
  if (input.assigneeId) await assertActiveStaff(db, ctx, [input.assigneeId]);
}

/** Assignees automatically become project members so they can open the project. */
async function ensureProjectMember(db: DbOrTx, orgId: string, projectId: string, userId: string | null) {
  if (!userId) return;
  await db.insert(projectMembers).values({ organizationId: orgId, projectId, userId }).onConflictDoNothing();
}

async function notifyAssignee(db: DbOrTx, ctx: AuthContext, task: { id: string; title: string; projectId: string }, assigneeId: string | null) {
  if (!assigneeId) return;
  await notify(db, {
    orgId: ctx.orgId,
    userIds: [assigneeId],
    actorId: ctx.userId,
    type: "task_assigned",
    title: `New task: ${task.title}`,
    body: `${ctx.fullName} assigned you a task.`,
    link: `/app/projects/${task.projectId}/tasks?task=${task.id}`,
    dedupeKey: `task-assigned:${task.id}:${assigneeId}`,
    email: true,
  });
}

export async function createTask(db: Database, ctx: AuthContext, input: z.infer<typeof taskSchema>) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  await validateRelations(db, ctx, project.id, input);
  const task = await db.transaction(async (tx) => {
    const [{ maxPos } = { maxPos: 0 }] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${tasks.position}), 0)::int` })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), eq(tasks.status, input.status)));
    const [t] = await tx
      .insert(tasks)
      .values({
        organizationId: ctx.orgId,
        projectId: project.id,
        milestoneId: nn(input.milestoneId),
        parentTaskId: nn(input.parentTaskId),
        title: input.title,
        description: nn(input.description),
        assigneeId: nn(input.assigneeId),
        priority: input.priority,
        status: input.status,
        startDate: nn(input.startDate),
        dueDate: nn(input.dueDate),
        estimatedHours: nn(input.estimatedHours),
        position: maxPos + 1,
        createdById: ctx.userId,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      })
      .returning();
    await ensureProjectMember(tx, ctx.orgId, project.id, t!.assigneeId);
    await recalcProjectProgress(tx, project.id);
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t!.id,
      projectId: project.id,
      action: "created",
      summary: `${ctx.fullName} created task ${t!.title}`,
    });
    return t!;
  });
  await notifyAssignee(db, ctx, task, task.assigneeId);
  return task;
}

export async function updateTask(db: Database, ctx: AuthContext, input: z.infer<typeof updateTaskSchema>) {
  assertManager(ctx);
  const { task, project } = await getAccessibleTask(db, ctx, input.id);
  await validateRelations(db, ctx, project.id, input);
  const newAssignee = nn(input.assigneeId);
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        title: input.title,
        description: nn(input.description),
        milestoneId: nn(input.milestoneId),
        assigneeId: newAssignee,
        priority: input.priority,
        status: input.status,
        startDate: nn(input.startDate),
        dueDate: nn(input.dueDate),
        estimatedHours: nn(input.estimatedHours),
        completedAt: input.status === "COMPLETED" ? (task.completedAt ?? new Date()) : null,
      })
      .where(and(eq(tasks.id, task.id), eq(tasks.organizationId, ctx.orgId)));
    await ensureProjectMember(tx, ctx.orgId, project.id, newAssignee);
    await recalcProjectProgress(tx, project.id);
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: task.id,
      projectId: project.id,
      action: "updated",
      summary: `${ctx.fullName} updated task ${input.title}`,
    });
  });
  if (newAssignee && newAssignee !== task.assigneeId) {
    await notifyAssignee(db, ctx, { id: task.id, title: input.title, projectId: project.id }, newAssignee);
  }
}

/** Status changes (and Kanban moves). Managers: any task. Employees: only tasks assigned to them. */
export async function updateTaskStatus(db: Database, ctx: AuthContext, input: { id: string; status: TaskStatus; position?: number }) {
  const { task, project } = await getAccessibleTask(db, ctx, input.id);
  if (!isManager(ctx) && task.assigneeId !== ctx.userId) {
    throw new ForbiddenError("You can only update tasks assigned to you.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(tasks)
      .set({
        status: input.status,
        position: input.position ?? task.position,
        completedAt: input.status === "COMPLETED" ? (task.completedAt ?? new Date()) : null,
      })
      .where(and(eq(tasks.id, task.id), eq(tasks.organizationId, ctx.orgId)));
    if (task.status !== input.status) {
      await recalcProjectProgress(tx, project.id);
      await logActivity(tx, {
        orgId: ctx.orgId,
        actorId: ctx.userId,
        entityType: "task",
        entityId: task.id,
        projectId: project.id,
        action: "status_changed",
        summary: `${ctx.fullName} moved "${task.title}" to ${input.status.replaceAll("_", " ").toLowerCase()}`,
        metadata: { from: task.status, to: input.status },
      });
    }
  });
}

export async function archiveTask(db: Database, ctx: AuthContext, taskId: string) {
  assertManager(ctx);
  const { task, project } = await getAccessibleTask(db, ctx, taskId);
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(tasks).set({ archivedAt: now }).where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.id, task.id)));
    await tx.update(tasks).set({ archivedAt: now }).where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.parentTaskId, task.id)));
    await recalcProjectProgress(tx, project.id);
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: task.id,
      projectId: project.id,
      action: "archived",
      summary: `${ctx.fullName} deleted task ${task.title}`,
    });
  });
}

export { addTaskComment } from "./task-comments";
