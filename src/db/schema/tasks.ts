import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, numeric, pgTable, text, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol, updatedAt } from "./_shared";
import { priorityEnum, taskStatusEnum, visibilityEnum } from "./enums";
import { organizations, users } from "./organizations";
import { milestones, projects } from "./projects";

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    milestoneId: uuid("milestone_id"),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    priority: priorityEnum("priority").notNull().default("MEDIUM"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
    position: integer("position").notNull().default(0),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: tsCol("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: tsCol("archived_at"),
  },
  (t) => [
    unique("tasks_org_id_unique").on(t.organizationId, t.id),
    foreignKey({
      name: "tasks_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tasks_milestone_fk",
      columns: [t.organizationId, t.milestoneId],
      foreignColumns: [milestones.organizationId, milestones.id],
    }),
    index("tasks_project_status_idx").on(t.projectId, t.status, t.position),
    index("tasks_assignee_status_idx").on(t.assigneeId, t.status),
    index("tasks_org_due_idx").on(t.organizationId, t.dueDate),
    index("tasks_parent_idx").on(t.parentTaskId),
    check("tasks_estimate_positive", sql`${t.estimatedHours} is null or ${t.estimatedHours} >= 0`),
    check("tasks_dates_order", sql`${t.startDate} is null or ${t.dueDate} is null or ${t.dueDate} >= ${t.startDate}`),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    foreignKey({
      name: "task_comments_task_fk",
      columns: [t.organizationId, t.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }).onDelete("cascade"),
    index("task_comments_task_idx").on(t.taskId, t.createdAt),
    check("task_comments_body_len", sql`char_length(${t.body}) between 1 and 5000`),
  ],
);

/** Project discussion. INTERNAL comments are never visible to client users. */
export const projectComments = pgTable(
  "project_comments",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
    createdAt: createdAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    foreignKey({
      name: "project_comments_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    index("project_comments_project_idx").on(t.projectId, t.createdAt),
    check("project_comments_body_len", sql`char_length(${t.body}) between 1 and 5000`),
  ],
);

/** Hours logged by team members. */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "time_entries_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "time_entries_task_fk",
      columns: [t.organizationId, t.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }),
    index("time_entries_user_date_idx").on(t.userId, t.workDate),
    index("time_entries_project_idx").on(t.projectId),
    check("time_entries_hours_range", sql`${t.hours} > 0 and ${t.hours} <= 24`),
  ],
);

