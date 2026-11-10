import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { notifications, users } from "@/db/schema";
import type { AuthContext } from "@/server/auth/types";
import { renderEmail, sendEmail } from "@/server/email";

export type NotifyInput = {
  orgId: string;
  userIds: string[];
  /** The person who caused the event; never notified about their own action. */
  actorId?: string | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Same key for the same event -> only one notification per user. */
  dedupeKey: string;
  email?: boolean;
};

/** Creates in-app notifications (deduplicated) and optionally emails the recipients. */
export async function notify(db: DbOrTx, input: NotifyInput): Promise<string[]> {
  const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  if (recipients.length === 0) return [];

  const inserted = await db
    .insert(notifications)
    .values(
      recipients.map((userId) => ({
        organizationId: input.orgId,
        userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 1000),
        link: input.link,
        dedupeKey: input.dedupeKey,
      })),
    )
    .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
    .returning({ userId: notifications.userId });

  const newRecipients = inserted.map((r) => r.userId);
  if (input.email && newRecipients.length > 0) {
    const rows = await db.select({ email: users.email }).from(users).where(inArray(users.id, newRecipients));
    const html = renderEmail({ heading: input.title, body: input.body ?? "", ctaLabel: input.link ? "Open AgencyOS" : undefined, ctaPath: input.link });
    await Promise.all(rows.map((r) => sendEmail({ to: r.email, subject: input.title, html })));
  }
  return newRecipients;
}

export async function listNotifications(db: DbOrTx, ctx: AuthContext, { page = 1, pageSize = 30 } = {}) {
  const where = and(eq(notifications.userId, ctx.userId), eq(notifications.organizationId, ctx.orgId));
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(notifications).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, pageSize };
}

export async function unreadNotificationCount(db: DbOrTx, ctx: AuthContext): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.userId), eq(notifications.organizationId, ctx.orgId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function markNotificationsRead(db: DbOrTx, ctx: AuthContext, ids: string[] | "all") {
  const base = and(eq(notifications.userId, ctx.userId), eq(notifications.organizationId, ctx.orgId), isNull(notifications.readAt));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(ids === "all" ? base : and(base, inArray(notifications.id, ids)));
}
