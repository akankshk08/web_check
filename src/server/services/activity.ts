import type { DbOrTx } from "@/db";
import { activityLogs } from "@/db/schema";

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
