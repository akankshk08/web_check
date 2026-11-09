import { and, between, eq, inArray, isNull, notInArray } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { milestones, projectMembers, projects, tasks } from "@/db/schema";
import { assertStaff, isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";

export type CalendarEvent = { id: string; date: string; title: string; kind: "task" | "milestone" | "project"; href: string; done: boolean; sub?: string };

/** Deadlines in a date range. scope "mine" = only my tasks + my projects' milestones. */
export async function getCalendarEvents(db: DbOrTx, ctx: AuthContext, from: string, to: string, scope: "org" | "mine") {
  assertStaff(ctx);
  const mine = scope === "mine" || !isManager(ctx);
  const myProjects = db.select({ id: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, ctx.userId));

  const [taskRows, milestoneRows, projectRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, date: tasks.dueDate, status: tasks.status, projectId: tasks.projectId, projectName: projects.name })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          eq(tasks.organizationId, ctx.orgId),
          isNull(tasks.archivedAt),
          isNull(projects.archivedAt),
          notInArray(tasks.status, ["CANCELLED"]),
          between(tasks.dueDate, from, to),
          mine ? eq(tasks.assigneeId, ctx.userId) : undefined,
        ),
      )
      .limit(500),
    db
      .select({ id: milestones.id, title: milestones.title, date: milestones.dueDate, status: milestones.status, projectId: milestones.projectId, projectName: projects.name })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(
        and(
          eq(milestones.organizationId, ctx.orgId),
          isNull(milestones.deletedAt),
          isNull(projects.archivedAt),
          between(milestones.dueDate, from, to),
          mine ? inArray(milestones.projectId, myProjects) : undefined,
        ),
      )
      .limit(300),
    db
      .select({ id: projects.id, title: projects.name, date: projects.dueDate, status: projects.status })
      .from(projects)
      .where(
        and(eq(projects.organizationId, ctx.orgId), isNull(projects.archivedAt), between(projects.dueDate, from, to), mine ? inArray(projects.id, myProjects) : undefined),
      )
      .limit(200),
  ]);

  const events: CalendarEvent[] = [
    ...projectRows.map((p) => ({ id: p.id, date: p.date!, title: `${p.title} due`, kind: "project" as const, href: `/app/projects/${p.id}`, done: p.status === "COMPLETED" })),
    ...milestoneRows.map((m) => ({ id: m.id, date: m.date!, title: m.title, sub: m.projectName, kind: "milestone" as const, href: `/app/projects/${m.projectId}/milestones`, done: m.status === "APPROVED" })),
    ...taskRows.map((t) => ({ id: t.id, date: t.date!, title: t.title, sub: t.projectName, kind: "task" as const, href: `/app/projects/${t.projectId}/tasks?task=${t.id}`, done: t.status === "COMPLETED" })),
  ];
  return events;
}
