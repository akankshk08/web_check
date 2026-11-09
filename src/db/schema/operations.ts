import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { clients } from "./clients";
import { maintenanceStatusEnum, maintenanceTypeEnum, priorityEnum, ticketStatusEnum } from "./enums";
import { organizations, users } from "./organizations";
import { projects } from "./projects";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    /** Prevents duplicate notifications for the same event. */
    dedupeKey: text("dedupe_key").notNull(),
    readAt: tsCol("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notifications_user_dedupe_unique").on(t.userId, t.dedupeKey),
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** Audit trail of everything that changes inside an organization. */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    projectId: uuid("project_id"),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    /** Client-visible activity (e.g. milestone approvals) can be shown in the portal. */
    clientVisible: boolean("client_visible").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "activity_logs_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    index("activity_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("activity_logs_project_created_idx").on(t.projectId, t.createdAt),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    projectId: uuid("project_id"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default("OPEN"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    staffResponse: text("staff_response"),
    resolvedAt: tsCol("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "support_tickets_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "support_tickets_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }),
    index("support_tickets_org_status_idx").on(t.organizationId, t.status),
    index("support_tickets_client_idx").on(t.clientId),
  ],
);

/** Website handover details for a delivered project (manually entered, not monitored). */
export const projectDeliveries = pgTable(
  "project_deliveries",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    productionUrl: text("production_url"),
    hostingProvider: text("hosting_provider"),
    domainProvider: text("domain_provider"),
    domainExpiry: date("domain_expiry"),
    sslExpiry: date("ssl_expiry"),
    deployedOn: date("deployed_on"),
    handoverNotes: text("handover_notes"),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "project_deliveries_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    uniqueIndex("project_deliveries_project_unique").on(t.projectId),
    index("project_deliveries_org_idx").on(t.organizationId),
  ],
);

export const maintenanceRecords = pgTable(
  "maintenance_records",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    type: maintenanceTypeEnum("type").notNull().default("UPDATE"),
    title: text("title").notNull(),
    description: text("description"),
    status: maintenanceStatusEnum("status").notNull().default("SCHEDULED"),
    scheduledFor: date("scheduled_for"),
    completedOn: date("completed_on"),
    hours: numeric("hours", { precision: 6, scale: 2 }),
    performedById: uuid("performed_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "maintenance_records_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    index("maintenance_records_org_idx").on(t.organizationId, t.scheduledFor),
    index("maintenance_records_project_idx").on(t.projectId),
    check("maintenance_hours_nonnegative", sql`${t.hours} is null or ${t.hours} >= 0`),
  ],
);

/** Fixed-window counters shared across serverless instances. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: tsCol("window_start").notNull(),
  count: integer("count").notNull().default(0),
});
