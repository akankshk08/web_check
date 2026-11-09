import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, numeric, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { clients } from "./clients";
import { invoiceStatusEnum, paymentMethodEnum } from "./enums";
import { organizations, users } from "./organizations";
import { projects } from "./projects";

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    projectId: uuid("project_id"),
    number: text("number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("DRAFT"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull().default("USD"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    sentAt: tsCol("sent_at"),
    paidAt: tsCol("paid_at"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    unique("invoices_org_id_unique").on(t.organizationId, t.id),
    uniqueIndex("invoices_org_number_unique").on(t.organizationId, t.number),
    foreignKey({
      name: "invoices_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }),
    index("invoices_org_status_idx").on(t.organizationId, t.status),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_org_issue_idx").on(t.organizationId, t.issueDate),
    check("invoices_amounts_nonnegative", sql`${t.subtotal} >= 0 and ${t.taxAmount} >= 0 and ${t.total} >= 0 and ${t.amountPaid} >= 0`),
    check("invoices_tax_range", sql`${t.taxRate} >= 0 and ${t.taxRate} <= 100`),
    check("invoices_dates_order", sql`${t.dueDate} >= ${t.issueDate}`),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: "invoice_items_invoice_fk",
      columns: [t.organizationId, t.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }).onDelete("cascade"),
    index("invoice_items_invoice_idx").on(t.invoiceId, t.position),
    check("invoice_items_quantity_positive", sql`${t.quantity} > 0`),
    check("invoice_items_price_nonnegative", sql`${t.unitPrice} >= 0`),
  ],
);

/** Manually recorded payments (no payment gateway in the MVP). */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paidOn: date("paid_on").notNull(),
    method: paymentMethodEnum("method").notNull().default("BANK_TRANSFER"),
    reference: text("reference"),
    notes: text("notes"),
    recordedById: uuid("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "payments_invoice_fk",
      columns: [t.organizationId, t.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    }).onDelete("cascade"),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_org_paid_idx").on(t.organizationId, t.paidOn),
    check("payments_amount_positive", sql`${t.amount} > 0`),
  ],
);
