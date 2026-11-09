import { and, count, desc, eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { activityLogs, users } from "@/db/schema";
import { isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { getAccessibleProject } from "./access";

export type ActivityInput = {
  orgId: string;
  actorId: string | null;
  entityType: "organization" | "member" | "invitation" | "client" | "project" | "milestone" | "task" | "file" | "invoice" | "payment" | "ticket" | "delivery" | "maintenance" | "comment";
  entityId?: string | null;
  projectId?: string | null;
  action: string;
  summary: string;
  clientVisible?: boolean;
  metadata?: Record<string, unknown>;
};

/** Writes an audit/activity entry. Call inside the same transaction as the change. */
export async function logActivity(db: DbOrTx, input: ActivityInput) {
  await db.insert(activityLogs).values({
    organizationId: input.orgId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    projectId: input.projectId ?? null,
    action: input.action,
    summary: input.summary.slice(0, 500),
    clientVisible: input.clientVisible ?? false,
    metadata: input.metadata,
  });
}

// ---------- Reading ----------

export const ACTIVITY_PAGE_SIZE = 30;

/** Project activity feed. Clients only see entries marked client-visible. */
export async function listProjectActivity(db: DbOrTx, ctx: AuthContext, projectId: string, page = 1) {
  const project = await getAccessibleProject(db, ctx, projectId, { allowClient: true });
  const where = and(
    eq(activityLogs.projectId, project.id),
    eq(activityLogs.organizationId, ctx.orgId),
    isClient(ctx) ? eq(activityLogs.clientVisible, true) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: activityLogs.id, summary: activityLogs.summary, action: activityLogs.action, entityType: activityLogs.entityType, createdAt: activityLogs.createdAt, actorName: users.fullName })
      .from(activityLogs)
      .leftJoin(users, eq(users.id, activityLogs.actorId))
      .where(where)
      .orderBy(desc(activityLogs.createdAt))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE),
    db.select({ value: count() }).from(activityLogs).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, pageSize: ACTIVITY_PAGE_SIZE };
}
