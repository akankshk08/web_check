import { and, asc, count, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { clients, invoiceItems, invoices, organizations, payments, projects } from "@/db/schema";
import type { InvoiceStatus } from "@/db/schema/enums";
import { todayISO } from "@/lib/dates";
import { assertFinance, isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { NotFoundError } from "@/server/errors";
import { likePattern } from "./clients";

export const INVOICE_PAGE_SIZE = 20;

/** Status shown to users: unpaid invoices past their due date read as OVERDUE. */
export function effectiveInvoiceStatus(inv: { status: InvoiceStatus; dueDate: string }, today = todayISO()): InvoiceStatus {
  if ((inv.status === "SENT" || inv.status === "PARTIALLY_PAID") && inv.dueDate < today) return "OVERDUE";
  return inv.status;
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
