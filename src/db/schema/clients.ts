import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { clientStatusEnum } from "./enums";
import { organizations, users } from "./organizations";

export const clients = pgTable(
  "clients",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    companyName: text("company_name"),
    phone: text("phone"),
    address: text("address"),
    /** Internal agency notes. Never shown in the client portal. */
    notes: text("notes"),
    status: clientStatusEnum("status").notNull().default("ACTIVE"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tsCol("archived_at"),
  },
  (t) => [
    unique("clients_org_id_unique").on(t.organizationId, t.id),
    // One active client record per email per agency (prevents accidental duplicates).
    uniqueIndex("clients_org_email_active_unique")
      .on(t.organizationId, sql`lower(${t.email})`)
      .where(sql`${t.archivedAt} is null`),
    index("clients_org_status_idx").on(t.organizationId, t.status),
    check("clients_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

/** Users who may log into the portal on behalf of a client account. */
export const clientMembers = pgTable(
  "client_members",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canApprove: boolean("can_approve").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "client_members_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("cascade"),
    uniqueIndex("client_members_client_user_unique").on(t.clientId, t.userId),
    index("client_members_user_idx").on(t.userId),
  ],
);
