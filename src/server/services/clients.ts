import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clientMembers, clients, invoices, organizationMembers, projects, users } from "@/db/schema";
import type { ClientStatus } from "@/db/schema/enums";
import { nn } from "@/lib/validations/common";
import type { clientSchema } from "@/lib/validations/entities";
import { assertManager, canManageFinance } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { ConflictError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";

export const CLIENT_PAGE_SIZE = 20;

/** Escape LIKE wildcards so user search text is matched literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listClients(
  db: DbOrTx,
  ctx: AuthContext,
  { q = "", status, archived = false, page = 1 }: { q?: string; status?: ClientStatus; archived?: boolean; page?: number },
) {
  assertManager(ctx);
  const where = and(
    eq(clients.organizationId, ctx.orgId),
    archived ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt),
    status ? eq(clients.status, status) : undefined,
    q
      ? or(ilike(clients.name, likePattern(q)), ilike(clients.email, likePattern(q)), ilike(clients.companyName, likePattern(q)))
      : undefined,
  );
  const projectCount = db
    .select({ clientId: projects.clientId, n: sql<number>`count(*)::int`.as("n") })
    .from(projects)
    .where(and(eq(projects.organizationId, ctx.orgId), isNull(projects.archivedAt)))
    .groupBy(projects.clientId)
    .as("pc");

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        companyName: clients.companyName,
        phone: clients.phone,
        status: clients.status,
        createdAt: clients.createdAt,
        archivedAt: clients.archivedAt,
        projectCount: sql<number>`coalesce(${projectCount.n}, 0)`,
      })
      .from(clients)
      .leftJoin(projectCount, eq(projectCount.clientId, clients.id))
      .where(where)
      .orderBy(desc(clients.createdAt))
      .limit(CLIENT_PAGE_SIZE)
      .offset((page - 1) * CLIENT_PAGE_SIZE),
    db.select({ value: count() }).from(clients).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, pageSize: CLIENT_PAGE_SIZE };
}

/** Options for selects (active clients only). */
export async function listClientOptions(db: DbOrTx, ctx: AuthContext) {
  assertManager(ctx);
  return db
    .select({ id: clients.id, name: clients.name, companyName: clients.companyName })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.orgId), isNull(clients.archivedAt)))
    .orderBy(clients.companyName, clients.name)
    .limit(500);
}

export async function getClient(db: DbOrTx, ctx: AuthContext, clientId: string) {
  assertManager(ctx);
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.orgId)))
    .limit(1);
  if (!client) throw new NotFoundError("Client not found.");

  const [clientProjects, clientInvoices, portalUsers] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, status: projects.status, progress: projects.progress, dueDate: projects.dueDate })
      .from(projects)
      .where(and(eq(projects.clientId, client.id), eq(projects.organizationId, ctx.orgId), isNull(projects.archivedAt)))
      .orderBy(desc(projects.createdAt))
      .limit(100),
    canManageFinance(ctx)
      ? db
          .select({
            id: invoices.id,
            number: invoices.number,
            status: invoices.status,
            total: invoices.total,
            amountPaid: invoices.amountPaid,
            currency: invoices.currency,
            dueDate: invoices.dueDate,
          })
          .from(invoices)
          .where(and(eq(invoices.clientId, client.id), eq(invoices.organizationId, ctx.orgId), isNull(invoices.deletedAt)))
          .orderBy(desc(invoices.issueDate))
          .limit(100)
      : Promise.resolve(null),
    db
      .select({
        id: clientMembers.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        canApprove: clientMembers.canApprove,
        status: organizationMembers.status,
      })
      .from(clientMembers)
      .innerJoin(users, eq(users.id, clientMembers.userId))
      .innerJoin(
        organizationMembers,
        and(eq(organizationMembers.userId, clientMembers.userId), eq(organizationMembers.organizationId, clientMembers.organizationId)),
      )
      .where(and(eq(clientMembers.clientId, client.id), eq(clientMembers.organizationId, ctx.orgId))),
  ]);
  return { client, projects: clientProjects, invoices: clientInvoices, portalUsers };
}

function values(input: z.infer<typeof clientSchema>) {
  return {
    name: input.name,
    email: input.email,
    companyName: nn(input.companyName),
    phone: nn(input.phone),
    address: nn(input.address),
    notes: nn(input.notes),
    status: input.status,
  };
}

async function assertNoDuplicate(db: DbOrTx, ctx: AuthContext, email: string, exceptId?: string) {
  const [dup] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.orgId), eq(clients.email, email), isNull(clients.archivedAt)))
    .limit(1);
  if (dup && dup.id !== exceptId) throw new ConflictError("A client with this email already exists.");
}

export async function createClient(db: Database, ctx: AuthContext, input: z.infer<typeof clientSchema>) {
  assertManager(ctx);
  await assertNoDuplicate(db, ctx, input.email);
  return db.transaction(async (tx) => {
    const [client] = await tx
      .insert(clients)
      .values({ ...values(input), organizationId: ctx.orgId, createdById: ctx.userId })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "client",
      entityId: client!.id,
      action: "created",
      summary: `${ctx.fullName} added client ${input.companyName || input.name}`,
    });
    return client!;
  });
}

export async function updateClient(db: Database, ctx: AuthContext, id: string, input: z.infer<typeof clientSchema>) {
  assertManager(ctx);
  await assertNoDuplicate(db, ctx, input.email, id);
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(clients)
      .set(values(input))
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.orgId)))
      .returning({ id: clients.id });
    if (rows.length === 0) throw new NotFoundError("Client not found.");
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "client",
      entityId: id,
      action: "updated",
      summary: `${ctx.fullName} updated client ${input.companyName || input.name}`,
    });
  });
}

export async function setClientArchived(db: Database, ctx: AuthContext, id: string, archived: boolean) {
  assertManager(ctx);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ email: clients.email })
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.orgId)))
      .limit(1);
    if (!current) throw new NotFoundError("Client not found.");
    if (!archived) await assertNoDuplicate(tx, ctx, current.email, id);
    await tx
      .update(clients)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.orgId)));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "client",
      entityId: id,
      action: archived ? "archived" : "restored",
      summary: `${ctx.fullName} ${archived ? "archived" : "restored"} a client`,
    });
  });
}

/** Removes a portal user from a client account (and their client membership in the org if none remain). */
export async function removeClientUser(db: Database, ctx: AuthContext, clientMemberId: string) {
  assertManager(ctx);
  await db.transaction(async (tx) => {
    const [cm] = await tx
      .delete(clientMembers)
      .where(and(eq(clientMembers.id, clientMemberId), eq(clientMembers.organizationId, ctx.orgId)))
      .returning();
    if (!cm) throw new NotFoundError("Portal user not found.");
    const [remaining] = await tx
      .select({ value: count() })
      .from(clientMembers)
      .where(and(eq(clientMembers.userId, cm.userId), eq(clientMembers.organizationId, ctx.orgId)));
    if ((remaining?.value ?? 0) === 0) {
      await tx
        .update(organizationMembers)
        .set({ status: "REMOVED", removedAt: new Date() })
        .where(
          and(
            eq(organizationMembers.userId, cm.userId),
            eq(organizationMembers.organizationId, ctx.orgId),
            eq(organizationMembers.role, "CLIENT"),
          ),
        );
    }
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "client",
      entityId: cm.clientId,
      action: "portal_user_removed",
      summary: `${ctx.fullName} removed a client portal user`,
    });
  });
}

/** Client users (with approval rights) for a client account – used for notifications. */
export async function clientUserIds(db: DbOrTx, orgId: string, clientId: string, { approversOnly = false } = {}) {
  const rows = await db
    .select({ userId: clientMembers.userId })
    .from(clientMembers)
    .innerJoin(
      organizationMembers,
      and(eq(organizationMembers.userId, clientMembers.userId), eq(organizationMembers.organizationId, clientMembers.organizationId)),
    )
    .where(
      and(
        eq(clientMembers.organizationId, orgId),
        eq(clientMembers.clientId, clientId),
        eq(organizationMembers.status, "ACTIVE"),
        approversOnly ? eq(clientMembers.canApprove, true) : undefined,
      ),
    );
  return rows.map((r) => r.userId);
}
