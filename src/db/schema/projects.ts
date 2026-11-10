import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, numeric, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { clients } from "./clients";
import {
  approvalActionEnum,
  milestoneStatusEnum,
  priorityEnum,
  projectStatusEnum,
  projectTypeEnum,
} from "./enums";
import { organizations, users } from "./organizations";

export const projects = pgTable(
  "projects",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Internal-only notes, never exposed to clients. */
    internalNotes: text("internal_notes"),
    type: projectTypeEnum("type").notNull().default("WEBSITE"),
    status: projectStatusEnum("status").notNull().default("PLANNING"),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    budget: numeric("budget", { precision: 12, scale: 2 }),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    /** 0-100, recalculated from tasks whenever they change. */
    progress: integer("progress").notNull().default(0),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: tsCol("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tsCol("archived_at"),
  },
  (t) => [
    unique("projects_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "projects_client_fk",
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    index("projects_org_status_idx").on(t.organizationId, t.status),
    index("projects_client_idx").on(t.clientId),
    index("projects_org_due_idx").on(t.organizationId, t.dueDate),
    check("projects_progress_range", sql`${t.progress} between 0 and 100`),
    check("projects_budget_positive", sql`${t.budget} is null or ${t.budget} >= 0`),
    check("projects_dates_order", sql`${t.startDate} is null or ${t.dueDate} is null or ${t.dueDate} >= ${t.startDate}`),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "project_members_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    uniqueIndex("project_members_project_user_unique").on(t.projectId, t.userId),
    index("project_members_user_idx").on(t.userId),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    status: milestoneStatusEnum("status").notNull().default("NOT_STARTED"),
    position: integer("position").notNull().default(0),
    submittedAt: tsCol("submitted_at"),
    approvedAt: tsCol("approved_at"),
    approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    unique("milestones_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "milestones_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    index("milestones_project_idx").on(t.projectId, t.position),
    index("milestones_org_status_idx").on(t.organizationId, t.status),
  ],
);

/** Full review history for a milestone: submissions, approvals, change requests, feedback. */
export const milestoneApprovals = pgTable(
  "milestone_approvals",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").notNull(),
    action: approvalActionEnum("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "milestone_approvals_milestone_fk",
      columns: [t.organizationId, t.milestoneId],
      foreignColumns: [milestones.organizationId, milestones.id],
    }).onDelete("cascade"),
    index("milestone_approvals_milestone_idx").on(t.milestoneId, t.createdAt),
  ],
);
