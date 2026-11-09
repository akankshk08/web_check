import { and, asc, count, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clients, invoiceItems, invoices, organizations, payments, projects } from "@/db/schema";
import type { InvoiceStatus } from "@/db/schema/enums";
import { todayISO } from "@/lib/dates";
import { addMoney, calculateInvoiceTotals, compareMoney, subtractMoney } from "@/lib/money";
import { nn } from "@/lib/validations/common";
import type { invoiceSchema, paymentSchema } from "@/lib/validations/entities";
import { assertFinance, isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";
import { clientUserIds, likePattern } from "./clients";
import { notify } from "./notifications";

export const INVOICE_PAGE_SIZE = 20;
type InvoiceInput = z.infer<typeof invoiceSchema>;

/** Allocates the next organization-scoped invoice number atomically (row lock on the org). */
export async function allocateInvoiceNumber(tx: DbOrTx, orgId: string): Promise<string> {
  const [row] = await tx
    .update(organizations)
    .set({ nextInvoiceNumber: sql`${organizations.nextInvoiceNumber} + 1` })
    .where(eq(organizations.id, orgId))
    .returning({ next: organizations.nextInvoiceNumber, prefix: organizations.invoicePrefix });
  if (!row) throw new NotFoundError();
  return `${row.prefix}-${String(row.next - 1).padStart(4, "0")}`;
}

/** Status shown to users: unpaid invoices past their due date read as OVERDUE. */
export function effectiveInvoiceStatus(inv: { status: InvoiceStatus; dueDate: string }, today = todayISO()): InvoiceStatus {
  if ((inv.status === "SENT" || inv.status === "PARTIALLY_PAID") && inv.dueDate < today) return "OVERDUE";
  return inv.status;
}

async function validateClientAndProject(db: DbOrTx, ctx: AuthContext, clientId: string, projectId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.orgId)))
    .limit(1);
  if (!client) throw new BadRequestError("Select a valid client.");
  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, ctx.orgId), eq(projects.clientId, clientId)))
      .limit(1);
    if (!project) throw new BadRequestError("The project must belong to the selected client.");
  }
}

async function writeItems(tx: DbOrTx, ctx: AuthContext, invoiceId: string, input: InvoiceInput) {
  const totals = calculateInvoiceTotals(input.items, input.taxRate);
  await tx.insert(invoiceItems).values(
    input.items.map((item, i) => ({
      organizationId: ctx.orgId,
      invoiceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: totals.lineAmounts[i]!,
      position: i,
    })),
  );
  return totals;
}

export async function createInvoice(db: Database, ctx: AuthContext, input: InvoiceInput) {
  assertFinance(ctx);
  await validateClientAndProject(db, ctx, input.clientId, input.projectId);
  return db.transaction(async (tx) => {
    const [org] = await tx.select({ currency: organizations.currency }).from(organizations).where(eq(organizations.id, ctx.orgId));
    const number = await allocateInvoiceNumber(tx, ctx.orgId);
    const [inv] = await tx
      .insert(invoices)
      .values({
        organizationId: ctx.orgId,
        clientId: input.clientId,
        projectId: nn(input.projectId),
        number,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        currency: org?.currency ?? "USD",
        taxRate: input.taxRate,
        notes: nn(input.notes),
        createdById: ctx.userId,
      })
      .returning();
    const totals = await writeItems(tx, ctx, inv!.id, input);
    await tx
      .update(invoices)
      .set({ subtotal: totals.subtotal, taxAmount: totals.taxAmount, total: totals.total })
      .where(eq(invoices.id, inv!.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "invoice",
      entityId: inv!.id,
      projectId: inv!.projectId,
      action: "created",
      summary: `${ctx.fullName} created invoice ${number}`,
    });
    return { ...inv!, ...totals };
  });
}

async function loadInvoiceForFinance(db: DbOrTx, ctx: AuthContext, id: string) {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, ctx.orgId), isNull(invoices.deletedAt)))
    .limit(1);
  if (!inv) throw new NotFoundError("Invoice not found.");
  return inv;
}

/** Only drafts can be edited; items are replaced and totals recalculated. */
export async function updateInvoice(db: Database, ctx: AuthContext, id: string, input: InvoiceInput) {
  assertFinance(ctx);
  const inv = await loadInvoiceForFinance(db, ctx, id);
  if (inv.status !== "DRAFT") throw new BadRequestError("Only draft invoices can be edited.");
  await validateClientAndProject(db, ctx, input.clientId, input.projectId);
  await db.transaction(async (tx) => {
    await tx.delete(invoiceItems).where(and(eq(invoiceItems.invoiceId, id), eq(invoiceItems.organizationId, ctx.orgId)));
    const totals = await writeItems(tx, ctx, id, input);
    await tx
      .update(invoices)
      .set({
        clientId: input.clientId,
        projectId: nn(input.projectId),
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        taxRate: input.taxRate,
        notes: nn(input.notes),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
      })
      .where(eq(invoices.id, id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "invoice",
      entityId: id,
      action: "updated",
      summary: `${ctx.fullName} updated invoice ${inv.number}`,
    });
  });
}

export async function setInvoiceStatus(db: Database, ctx: AuthContext, id: string, status: "SENT" | "CANCELLED" | "DRAFT") {
  assertFinance(ctx);
  const inv = await loadInvoiceForFinance(db, ctx, id);
  const paid = compareMoney(inv.amountPaid, "0") > 0;
  if (status === "SENT" && inv.status !== "DRAFT") throw new BadRequestError("Only drafts can be sent.");
  if (status === "DRAFT" && (inv.status !== "SENT" || paid)) throw new BadRequestError("Only unpaid sent invoices can return to draft.");
  if (status === "CANCELLED" && (inv.status === "PAID" || inv.status === "CANCELLED")) throw new BadRequestError("This invoice can't be cancelled.");
  if (status === "SENT" && compareMoney(inv.total, "0") <= 0) throw new BadRequestError("An invoice must have a total above zero.");

  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status, sentAt: status === "SENT" ? new Date() : inv.sentAt })
      .where(eq(invoices.id, id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "invoice",
      entityId: id,
      action: `status_${status.toLowerCase()}`,
      summary: `${ctx.fullName} marked invoice ${inv.number} as ${status.toLowerCase()}`,
    });
  });
  if (status === "SENT") {
    await notify(db, {
      orgId: ctx.orgId,
      userIds: await clientUserIds(db, ctx.orgId, inv.clientId),
      actorId: ctx.userId,
      type: "invoice_sent",
      title: `New invoice ${inv.number}`,
      body: `Invoice ${inv.number} from ${ctx.orgName} is due on ${inv.dueDate}.`,
      link: `/portal/invoices?invoice=${inv.id}`,
      dedupeKey: `invoice-sent:${inv.id}`,
      email: true,
    });
  }
}

/** Manually records a payment; status becomes PARTIALLY_PAID or PAID. Never overpays. */
export async function recordPayment(db: Database, ctx: AuthContext, input: z.infer<typeof paymentSchema>) {
  assertFinance(ctx);
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, ctx.orgId), isNull(invoices.deletedAt)))
      .for("update")
      .limit(1);
    if (!inv) throw new NotFoundError("Invoice not found.");
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") throw new BadRequestError("Payments can only be recorded on sent invoices.");
    const balance = subtractMoney(inv.total, inv.amountPaid);
    if (compareMoney(input.amount, balance) > 0) throw new BadRequestError(`Payment exceeds the outstanding balance of ${balance}.`);

    await tx.insert(payments).values({
      organizationId: ctx.orgId,
      invoiceId: inv.id,
      amount: input.amount,
      paidOn: input.paidOn,
      method: input.method,
      reference: nn(input.reference),
      notes: nn(input.notes),
      recordedById: ctx.userId,
    });
    const amountPaid = addMoney(inv.amountPaid, input.amount);
    const fullyPaid = compareMoney(amountPaid, inv.total) >= 0;
    await tx
      .update(invoices)
      .set({ amountPaid, status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? new Date() : null })
      .where(eq(invoices.id, inv.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "payment",
      entityId: inv.id,
      action: "recorded",
      summary: `${ctx.fullName} recorded a payment of ${input.amount} on ${inv.number}`,
    });
    return { amountPaid, status: fullyPaid ? "PAID" : "PARTIALLY_PAID" };
  });
}

export async function deleteDraftInvoice(db: Database, ctx: AuthContext, id: string) {
  assertFinance(ctx);
  const inv = await loadInvoiceForFinance(db, ctx, id);
  if (inv.status !== "DRAFT") throw new BadRequestError("Only drafts can be deleted. Cancel sent invoices instead.");
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ deletedAt: new Date() }).where(eq(invoices.id, id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "invoice",
      entityId: id,
      action: "deleted",
      summary: `${ctx.fullName} deleted draft invoice ${inv.number}`,
    });
  });
}

export async function listInvoices(
  db: DbOrTx,
  ctx: AuthContext,
  { q = "", status, clientId, page = 1 }: { q?: string; status?: InvoiceStatus; clientId?: string; page?: number },
) {
  assertFinance(ctx);
  const today = todayISO();
  const statusWhere =
    status === "OVERDUE"
      ? and(inArray(invoices.status, ["SENT", "PARTIALLY_PAID", "OVERDUE"]), lt(invoices.dueDate, today))
      : status === "SENT" || status === "PARTIALLY_PAID"
        ? and(eq(invoices.status, status), sql`${invoices.dueDate} >= ${today}`)
        : status
          ? eq(invoices.status, status)
          : undefined;
  const where = and(
    eq(invoices.organizationId, ctx.orgId),
    isNull(invoices.deletedAt),
    statusWhere,
    clientId ? eq(invoices.clientId, clientId) : undefined,
    q ? or(ilike(invoices.number, likePattern(q)), ilike(clients.companyName, likePattern(q)), ilike(clients.name, likePattern(q))) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
        currency: invoices.currency,
        clientName: sql<string>`coalesce(${clients.companyName}, ${clients.name})`,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(where)
      .orderBy(desc(invoices.issueDate), desc(invoices.number))
      .limit(INVOICE_PAGE_SIZE)
      .offset((page - 1) * INVOICE_PAGE_SIZE),
    db.select({ value: count() }).from(invoices).innerJoin(clients, eq(clients.id, invoices.clientId)).where(where),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, status: effectiveInvoiceStatus(r, today) })),
    total: total?.value ?? 0,
    page,
    pageSize: INVOICE_PAGE_SIZE,
  };
}

/** Full invoice. Finance staff: any invoice in the org. Clients: their own non-draft invoices. */
export async function getInvoice(db: DbOrTx, ctx: AuthContext, id: string) {
  if (!isClient(ctx)) assertFinance(ctx);
  const [row] = await db
    .select({ invoice: invoices, client: clients, org: organizations })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(organizations, eq(organizations.id, invoices.organizationId))
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.organizationId, ctx.orgId),
        isNull(invoices.deletedAt),
        isClient(ctx) ? and(inArray(invoices.clientId, ctx.clientIds.length ? ctx.clientIds : ["00000000-0000-0000-0000-000000000000"]), ne(invoices.status, "DRAFT")) : undefined,
      ),
    )
    .limit(1);
  if (!row) throw new NotFoundError("Invoice not found.");
  const [items, paymentRows, project] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position)),
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidOn)),
    row.invoice.projectId
      ? db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, row.invoice.projectId)).then((r) => r[0] ?? null)
      : null,
  ]);
  const client = isClient(ctx) ? { ...row.client, notes: null } : row.client;
  return {
    invoice: { ...row.invoice, status: effectiveInvoiceStatus(row.invoice) },
    client,
    org: row.org,
    items,
    payments: paymentRows,
    project,
  };
}

/** Invoices visible in the client portal. */
export async function listClientInvoices(db: DbOrTx, ctx: AuthContext) {
  if (!isClient(ctx) || ctx.clientIds.length === 0) return [];
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, ctx.orgId),
        inArray(invoices.clientId, ctx.clientIds),
        ne(invoices.status, "DRAFT"),
        isNull(invoices.deletedAt),
      ),
    )
    .orderBy(desc(invoices.issueDate))
    .limit(200);
  return rows.map((r) => ({ ...r, status: effectiveInvoiceStatus(r) }));
}

/** Cron: persist OVERDUE status for unpaid invoices past due (all orgs). */
export async function markOverdueInvoices(db: DbOrTx) {
  const rows = await db
    .update(invoices)
    .set({ status: "OVERDUE" })
    .where(and(inArray(invoices.status, ["SENT", "PARTIALLY_PAID"]), lt(invoices.dueDate, todayISO()), isNull(invoices.deletedAt)))
    .returning({ id: invoices.id });
  return rows.length;
}
