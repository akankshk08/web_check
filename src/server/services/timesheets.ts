import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { DbOrTx } from "@/db";
import { projects, tasks, timeEntries } from "@/db/schema";
import { nn } from "@/lib/validations/common";
import type { timeEntrySchema } from "@/lib/validations/entities";
import { assertStaff, isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "./access";

export async function logTime(db: DbOrTx, ctx: AuthContext, input: z.infer<typeof timeEntrySchema>) {
  assertStaff(ctx);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  if (input.taskId) {
    const [t] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, project.id), isNull(tasks.archivedAt)))
      .limit(1);
    if (!t) throw new BadRequestError("Task does not belong to this project.");
  }
  if (input.workDate > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) {
    throw new BadRequestError("You can't log time in the future.");
  }
  const [row] = await db
    .insert(timeEntries)
    .values({
      organizationId: ctx.orgId,
      projectId: project.id,
      taskId: nn(input.taskId),
      userId: ctx.userId,
      workDate: input.workDate,
      hours: input.hours,
      description: nn(input.description),
    })
    .returning();
  return row!;
}

export async function listMyTime(db: DbOrTx, ctx: AuthContext, { from, to }: { from: string; to: string }) {
  assertStaff(ctx);
  return db
    .select({
      id: timeEntries.id,
      workDate: timeEntries.workDate,
      hours: timeEntries.hours,
      description: timeEntries.description,
      projectId: projects.id,
      projectName: projects.name,
      taskTitle: tasks.title,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(
      and(
        eq(timeEntries.organizationId, ctx.orgId),
        eq(timeEntries.userId, ctx.userId),
        gte(timeEntries.workDate, from),
        lte(timeEntries.workDate, to),
      ),
    )
    .orderBy(desc(timeEntries.workDate), desc(timeEntries.createdAt))
    .limit(500);
}

export async function deleteTimeEntry(db: DbOrTx, ctx: AuthContext, id: string) {
  assertStaff(ctx);
  const rows = await db
    .delete(timeEntries)
    .where(
      and(
        eq(timeEntries.id, id),
        eq(timeEntries.organizationId, ctx.orgId),
        isManager(ctx) ? undefined : eq(timeEntries.userId, ctx.userId),
      ),
    )
    .returning({ id: timeEntries.id });
  if (rows.length === 0) throw new NotFoundError("Time entry not found.");
}

export async function projectHours(db: DbOrTx, projectId: string) {
  const [row] = await db
    .select({ hours: sql<string>`coalesce(sum(${timeEntries.hours}),0)::text` })
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId));
  return Number(row?.hours ?? 0);
}
