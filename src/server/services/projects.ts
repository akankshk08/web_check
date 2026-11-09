import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clients, organizationMembers, projectMembers, projects, tasks, users } from "@/db/schema";
import type { ProjectStatus } from "@/db/schema/enums";
import { nn } from "@/lib/validations/common";
import type { projectSchema } from "@/lib/validations/entities";
import { assertManager, assertStaff, isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError } from "@/server/errors";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { likePattern } from "./clients";
import { notify } from "./notifications";
import { assertActiveStaff } from "./team";

export const PROJECT_PAGE_SIZE = 20;
const SORTS: Record<string, SQL[]> = {
  updated: [desc(projects.updatedAt)],
  due: [sql`${projects.dueDate} asc nulls last`],
  name: [asc(projects.name)],
  progress: [desc(projects.progress)],
};
export const PROJECT_SORTS = Object.keys(SORTS);

type ProjectInput = Omit<z.infer<typeof projectSchema>, never>;

export async function listProjects(
  db: DbOrTx,
  ctx: AuthContext,
  opts: { q?: string; status?: ProjectStatus; clientId?: string; sort?: string; archived?: boolean; page?: number; onlyMine?: boolean },
) {
  assertStaff(ctx);
  const page = opts.page ?? 1;
  const mine = !isManager(ctx) || opts.onlyMine;
  const where = and(
    eq(projects.organizationId, ctx.orgId),
    opts.archived && isManager(ctx) ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
    opts.status ? eq(projects.status, opts.status) : undefined,
    opts.clientId ? eq(projects.clientId, opts.clientId) : undefined,
    opts.q ? ilike(projects.name, likePattern(opts.q)) : undefined,
    mine
      ? inArray(projects.id, db.select({ id: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, ctx.userId)))
      : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        priority: projects.priority,
        type: projects.type,
        progress: projects.progress,
        dueDate: projects.dueDate,
        budget: projects.budget,
        clientId: projects.clientId,
        clientName: sql<string>`coalesce(${clients.companyName}, ${clients.name})`,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(where)
      .orderBy(...(SORTS[opts.sort ?? "updated"] ?? SORTS.updated!))
      .limit(PROJECT_PAGE_SIZE)
      .offset((page - 1) * PROJECT_PAGE_SIZE),
    db.select({ value: count() }).from(projects).where(where),
  ]);

  const ids = rows.map((r) => r.id);
  const members = ids.length
    ? await db
        .select({ projectId: projectMembers.projectId, userId: users.id, fullName: users.fullName })
        .from(projectMembers)
        .innerJoin(users, eq(users.id, projectMembers.userId))
        .where(inArray(projectMembers.projectId, ids))
    : [];
  return {
    rows: rows.map((r) => ({ ...r, members: members.filter((m) => m.projectId === r.id) })),
    total: total?.value ?? 0,
    page,
    pageSize: PROJECT_PAGE_SIZE,
  };
}

export async function getProjectDetail(db: DbOrTx, ctx: AuthContext, projectId: string) {
  assertStaff(ctx);
  const project = await getAccessibleProject(db, ctx, projectId, { includeArchived: true });
  const [client, members, taskStats] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, companyName: clients.companyName, email: clients.email })
      .from(clients)
      .where(eq(clients.id, project.clientId))
      .limit(1)
      .then((r) => r[0]!),
    db
      .select({ userId: users.id, fullName: users.fullName, email: users.email, jobTitle: users.jobTitle })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, project.id))
      .orderBy(users.fullName),
    db
      .select({
        total: sql<number>`count(*) filter (where ${tasks.status} <> 'CANCELLED')::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'COMPLETED')::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.status} not in ('COMPLETED','CANCELLED') and ${tasks.dueDate} < current_date)::int`,
        estimate: sql<string>`coalesce(sum(${tasks.estimatedHours}),0)::text`,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), isNull(tasks.archivedAt)))
      .then((r) => r[0]!),
  ]);
  // Internal notes and budget are hidden from employees.
  const visible = isManager(ctx) ? project : { ...project, budget: null, internalNotes: null };
  return { project: visible, client, members, taskStats };
}

/** Recomputes stored progress (0-100) from the project's non-cancelled tasks. */
export async function recalcProjectProgress(db: DbOrTx, projectId: string) {
  await db.execute(sql`
    update projects set progress = coalesce((
      select round(100.0 * count(*) filter (where status = 'COMPLETED') / nullif(count(*), 0))
      from tasks where project_id = ${projectId} and archived_at is null and status <> 'CANCELLED'
    ), 0)::int
    where id = ${projectId}`);
}

async function assertClientInOrg(db: DbOrTx, ctx: AuthContext, clientId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.orgId), isNull(clients.archivedAt)))
    .limit(1);
  if (!client) throw new BadRequestError("Select a valid client.");
}

function projectValues(input: ProjectInput) {
  return {
    name: input.name,
    description: nn(input.description),
    internalNotes: nn(input.internalNotes),
    clientId: input.clientId,
    type: input.type,
    status: input.status,
    priority: input.priority,
    budget: nn(input.budget),
    startDate: nn(input.startDate),
    dueDate: nn(input.dueDate),
  };
}

export async function managerUserIds(db: DbOrTx, orgId: string) {
  const rows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.status, "ACTIVE"),
        inArray(organizationMembers.role, ["OWNER", "ADMIN"]),
      ),
    );
  return rows.map((r) => r.userId);
}

export async function projectMemberIds(db: DbOrTx, projectId: string) {
  const rows = await db.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, projectId));
  return rows.map((r) => r.userId);
}

export async function createProject(db: Database, ctx: AuthContext, input: ProjectInput) {
  assertManager(ctx);
  await assertClientInOrg(db, ctx, input.clientId);
  await assertActiveStaff(db, ctx, input.memberIds);

  const project = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({
        ...projectValues(input),
        organizationId: ctx.orgId,
        createdById: ctx.userId,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      })
      .returning();
    const memberIds = [...new Set(input.memberIds)];
    if (memberIds.length) {
      await tx.insert(projectMembers).values(memberIds.map((userId) => ({ organizationId: ctx.orgId, projectId: p!.id, userId })));
    }
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "project",
      entityId: p!.id,
      projectId: p!.id,
      action: "created",
      summary: `${ctx.fullName} created project ${p!.name}`,
    });
    return p!;
  });

  await notify(db, {
    orgId: ctx.orgId,
    userIds: [...input.memberIds, ...(await managerUserIds(db, ctx.orgId))],
    actorId: ctx.userId,
    type: "project_created",
    title: `New project: ${project.name}`,
    body: `${ctx.fullName} created the project ${project.name}.`,
    link: `/app/projects/${project.id}`,
    dedupeKey: `project-created:${project.id}`,
    email: true,
  });
  return project;
}

export async function updateProject(db: Database, ctx: AuthContext, id: string, input: ProjectInput) {
  assertManager(ctx);
  const existing = await getAccessibleProject(db, ctx, id, { includeArchived: true });
  await assertClientInOrg(db, ctx, input.clientId);
  await assertActiveStaff(db, ctx, input.memberIds);

  const added = await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({
        ...projectValues(input),
        completedAt: input.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      })
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.orgId)));

    const current = await projectMemberIds(tx, id);
    const wanted = [...new Set(input.memberIds)];
    const toAdd = wanted.filter((u) => !current.includes(u));
    const toRemove = current.filter((u) => !wanted.includes(u));
    if (toAdd.length) {
      await tx.insert(projectMembers).values(toAdd.map((userId) => ({ organizationId: ctx.orgId, projectId: id, userId })));
    }
    if (toRemove.length) {
      await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, id), inArray(projectMembers.userId, toRemove)));
    }
    const statusChanged = existing.status !== input.status;
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "project",
      entityId: id,
      projectId: id,
      action: statusChanged ? "status_changed" : "updated",
      summary: statusChanged
        ? `${ctx.fullName} moved ${input.name} to ${input.status.replace("_", " ").toLowerCase()}`
        : `${ctx.fullName} updated project ${input.name}`,
      clientVisible: statusChanged,
    });
    return toAdd;
  });

  if (added.length) {
    await notify(db, {
      orgId: ctx.orgId,
      userIds: added,
      actorId: ctx.userId,
      type: "project_assigned",
      title: `You were added to ${input.name}`,
      link: `/app/projects/${id}`,
      dedupeKey: `project-member:${id}:${Date.now()}`,
    });
  }
}

export async function setProjectArchived(db: Database, ctx: AuthContext, id: string, archived: boolean) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, id, { includeArchived: true });
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.orgId)));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "project",
      entityId: id,
      projectId: id,
      action: archived ? "archived" : "restored",
      summary: `${ctx.fullName} ${archived ? "archived" : "restored"} project ${project.name}`,
    });
  });
}

/** Simple project options for selects. */
export async function listProjectOptions(db: DbOrTx, ctx: AuthContext, { clientId }: { clientId?: string } = {}) {
  assertStaff(ctx);
  return db
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, ctx.orgId),
        isNull(projects.archivedAt),
        clientId ? eq(projects.clientId, clientId) : undefined,
        isManager(ctx)
          ? undefined
          : inArray(projects.id, db.select({ id: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, ctx.userId))),
      ),
    )
    .orderBy(projects.name)
    .limit(500);
}

export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "ACTIVE", "ON_HOLD", "IN_REVIEW"];
export const notDone = notInArray(projects.status, ["COMPLETED", "CANCELLED"]);
