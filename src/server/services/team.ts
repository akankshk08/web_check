import { and, desc, eq, gte, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "@/db";
import { organizationMembers, projectMembers, projects, tasks, timeEntries, users } from "@/db/schema";
import { addDaysISO } from "@/lib/dates";
import { assertManager, assertOwner, isOwner } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";

const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED"] as const;

/** Active staff (owner/admin/employee) with workload figures. Visible to all staff. */
export async function listTeam(db: DbOrTx, ctx: AuthContext) {
  const members = await db
    .select({
      memberId: organizationMembers.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      jobTitle: users.jobTitle,
      role: organizationMembers.role,
      canManageFinances: organizationMembers.canManageFinances,
      weeklyCapacityHours: organizationMembers.weeklyCapacityHours,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, ctx.orgId),
        eq(organizationMembers.status, "ACTIVE"),
        ne(organizationMembers.role, "CLIENT"),
      ),
    )
    .orderBy(users.fullName);

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return [];
  const since = addDaysISO(-6);

  const [taskCounts, hours, projectCounts] = await Promise.all([
    db
      .select({
        userId: tasks.assigneeId,
        open: sql<number>`count(*) filter (where ${tasks.status} in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED'))::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.status} in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED') and ${tasks.dueDate} < current_date)::int`,
        estimate: sql<string>`coalesce(sum(${tasks.estimatedHours}) filter (where ${tasks.status} in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED')), 0)::text`,
      })
      .from(tasks)
      .where(and(eq(tasks.organizationId, ctx.orgId), isNull(tasks.archivedAt), inArray(tasks.assigneeId, userIds)))
      .groupBy(tasks.assigneeId),
    db
      .select({ userId: timeEntries.userId, hours: sql<string>`coalesce(sum(${timeEntries.hours}),0)::text` })
      .from(timeEntries)
      .where(and(eq(timeEntries.organizationId, ctx.orgId), gte(timeEntries.workDate, since), inArray(timeEntries.userId, userIds)))
      .groupBy(timeEntries.userId),
    db
      .select({ userId: projectMembers.userId, count: sql<number>`count(*)::int` })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projects.organizationId, ctx.orgId),
          isNull(projects.archivedAt),
          notInArray(projects.status, ["COMPLETED", "CANCELLED"]),
          inArray(projectMembers.userId, userIds),
        ),
      )
      .groupBy(projectMembers.userId),
  ]);

  return members.map((m) => {
    const t = taskCounts.find((x) => x.userId === m.userId);
    return {
      ...m,
      openTasks: t?.open ?? 0,
      overdueTasks: t?.overdue ?? 0,
      openEstimateHours: Number(t?.estimate ?? 0),
      hoursLast7Days: Number(hours.find((x) => x.userId === m.userId)?.hours ?? 0),
      activeProjects: projectCounts.find((x) => x.userId === m.userId)?.count ?? 0,
    };
  });
}

/** Staff list for pickers (assignees, project members). */
export async function listStaffOptions(db: DbOrTx, ctx: AuthContext) {
  return db
    .select({ userId: users.id, fullName: users.fullName, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, ctx.orgId),
        eq(organizationMembers.status, "ACTIVE"),
        ne(organizationMembers.role, "CLIENT"),
      ),
    )
    .orderBy(users.fullName);
}

/** Verifies every id is an active staff member of the org. Prevents cross-org assignment. */
export async function assertActiveStaff(db: DbOrTx, ctx: AuthContext, userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const rows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, ctx.orgId),
        eq(organizationMembers.status, "ACTIVE"),
        ne(organizationMembers.role, "CLIENT"),
        inArray(organizationMembers.userId, ids),
      ),
    );
  if (rows.length !== ids.length) throw new BadRequestError("One or more selected team members are not in this workspace.");
}

export async function getMemberProfile(db: DbOrTx, ctx: AuthContext, memberId: string) {
  const [member] = await db
    .select({
      memberId: organizationMembers.id,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      jobTitle: users.jobTitle,
      phone: users.phone,
      role: organizationMembers.role,
      canManageFinances: organizationMembers.canManageFinances,
      weeklyCapacityHours: organizationMembers.weeklyCapacityHours,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, ctx.orgId),
        eq(organizationMembers.status, "ACTIVE"),
        ne(organizationMembers.role, "CLIENT"),
      ),
    )
    .limit(1);
  if (!member) throw new NotFoundError("Team member not found.");
  // Employees can see colleagues' basic profile only; workload details are for managers or self.
  if (ctx.role === "EMPLOYEE" && member.userId !== ctx.userId) {
    return { member, projects: [], tasks: [], timeEntries: [], restricted: true as const };
  }

  const [memberProjects, memberTasks, entries] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, status: projects.status, dueDate: projects.dueDate, progress: projects.progress })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projectMembers.userId, member.userId), eq(projects.organizationId, ctx.orgId), isNull(projects.archivedAt)))
      .orderBy(desc(projects.updatedAt))
      .limit(50),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
        projectName: projects.name,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          eq(tasks.assigneeId, member.userId),
          eq(tasks.organizationId, ctx.orgId),
          isNull(tasks.archivedAt),
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        ),
      )
      .orderBy(sql`${tasks.dueDate} asc nulls last`)
      .limit(50),
    db
      .select({
        id: timeEntries.id,
        workDate: timeEntries.workDate,
        hours: timeEntries.hours,
        description: timeEntries.description,
        projectName: projects.name,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(projects.id, timeEntries.projectId))
      .where(and(eq(timeEntries.userId, member.userId), eq(timeEntries.organizationId, ctx.orgId)))
      .orderBy(desc(timeEntries.workDate))
      .limit(20),
  ]);
  return { member, projects: memberProjects, tasks: memberTasks, timeEntries: entries, restricted: false as const };
}

async function loadTarget(db: DbOrTx, ctx: AuthContext, memberId: string) {
  const [target] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, ctx.orgId),
        eq(organizationMembers.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!target) throw new NotFoundError("Member not found.");
  return target;
}

/** Only the owner manages admins (promote/demote). */
export async function changeMemberRole(db: Database, ctx: AuthContext, memberId: string, role: "ADMIN" | "EMPLOYEE") {
  assertOwner(ctx);
  const target = await loadTarget(db, ctx, memberId);
  if (target.role === "OWNER" || target.role === "CLIENT") throw new BadRequestError("This member's role can't be changed here.");
  await db.transaction(async (tx) => {
    await tx
      .update(organizationMembers)
      .set({ role, canManageFinances: role === "ADMIN" ? target.canManageFinances : false })
      .where(eq(organizationMembers.id, target.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "member",
      entityId: target.id,
      action: "role_changed",
      summary: `${ctx.fullName} changed a member's role to ${role.toLowerCase()}`,
    });
  });
}

export async function setFinanceAccess(db: DbOrTx, ctx: AuthContext, memberId: string, canManageFinances: boolean) {
  assertOwner(ctx);
  const target = await loadTarget(db, ctx, memberId);
  if (target.role !== "ADMIN") throw new BadRequestError("Finance access can only be granted to admins.");
  await db.update(organizationMembers).set({ canManageFinances }).where(eq(organizationMembers.id, target.id));
}

/** Removes a team member (soft): ends membership, project memberships and open task assignments. */
export async function removeMember(db: Database, ctx: AuthContext, memberId: string) {
  assertManager(ctx);
  const target = await loadTarget(db, ctx, memberId);
  if (target.role === "OWNER") throw new BadRequestError("The owner can't be removed. Transfer ownership first.");
  if (target.userId === ctx.userId) throw new BadRequestError("You can't remove yourself.");
  if (target.role === "ADMIN" && !isOwner(ctx)) throw new ForbiddenError("Only the owner can remove admins.");
  if (target.role === "CLIENT") throw new BadRequestError("Remove client users from the client's page.");

  await db.transaction(async (tx) => {
    await tx
      .update(organizationMembers)
      .set({ status: "REMOVED", removedAt: new Date(), canManageFinances: false })
      .where(eq(organizationMembers.id, target.id));
    await tx
      .delete(projectMembers)
      .where(and(eq(projectMembers.organizationId, ctx.orgId), eq(projectMembers.userId, target.userId)));
    await tx
      .update(tasks)
      .set({ assigneeId: null })
      .where(
        and(
          eq(tasks.organizationId, ctx.orgId),
          eq(tasks.assigneeId, target.userId),
          inArray(tasks.status, [...OPEN_TASK_STATUSES]),
        ),
      );
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "member",
      entityId: target.id,
      action: "removed",
      summary: `${ctx.fullName} removed a team member`,
    });
  });
}
