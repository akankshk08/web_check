import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clients, invoiceItems, invoices, organizations, payments, projects } from "@/db/schema";
import { addMoney, calculateInvoiceTotals, compareMoney, subtractMoney } from "@/lib/money";
import { nn } from "@/lib/validations/common";
import type { invoiceSchema, paymentSchema } from "@/lib/validations/entities";
import { assertFinance } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";
import { clientUserIds } from "./clients";
import { notify } from "./notifications";

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


export * from "./invoices-read";
