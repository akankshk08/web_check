import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { clients } from "./clients";
import { memberStatusEnum, orgRoleEnum } from "./enums";

/**
 * Application profile for a Supabase Auth user. `id` equals auth.users.id.
 * Passwords live only in Supabase Auth, never here.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    website: text("website"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    currency: text("currency").notNull().default("USD"),
    defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    uniqueIndex("organizations_slug_unique").on(t.slug),
    check("organizations_currency_len", sql`char_length(${t.currency}) = 3`),
    check("organizations_tax_range", sql`${t.defaultTaxRate} >= 0 and ${t.defaultTaxRate} <= 100`),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull(),
    status: memberStatusEnum("status").notNull().default("ACTIVE"),
    /** Admins can manage invoices only when the owner grants this. Owners always can. */
    canManageFinances: boolean("can_manage_finances").notNull().default(false),
    weeklyCapacityHours: integer("weekly_capacity_hours").notNull().default(40),
    joinedAt: createdAt(),
    removedAt: tsCol("removed_at"),
  },
  (t) => [
    uniqueIndex("org_members_org_user_unique").on(t.organizationId, t.userId),
    index("org_members_user_idx").on(t.userId),
    check("org_members_capacity", sql`${t.weeklyCapacityHours} between 0 and 168`),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: orgRoleEnum("role").notNull(),
    /** Set only for CLIENT invitations: which client account the user joins. */
    clientId: uuid("client_id"),
    /** SHA-256 of the token; the raw token is only ever emailed. */
    tokenHash: text("token_hash").notNull(),
    invitedById: uuid("invited_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tsCol("expires_at").notNull(),
    acceptedAt: tsCol("accepted_at"),
    acceptedById: uuid("accepted_by_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: tsCol("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "invitations_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("cascade"),
    uniqueIndex("invitations_token_hash_unique").on(t.tokenHash),
    index("invitations_org_idx").on(t.organizationId, t.createdAt),
    check("invitations_owner_not_invitable", sql`${t.role} <> 'OWNER'`),
    check(
      "invitations_client_role_consistency",
      sql`(${t.role} = 'CLIENT' and ${t.clientId} is not null) or (${t.role} <> 'CLIENT' and ${t.clientId} is null)`,
    ),
    check("invitations_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);
