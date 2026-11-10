import { sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tsCol } from "./_shared";
import { attachmentStatusEnum, visibilityEnum } from "./enums";
import { organizations, users } from "./organizations";
import { milestones, projects } from "./projects";
import { tasks } from "./tasks";

/**
 * Metadata for files stored in the private Supabase Storage bucket.
 * Files are only reachable through short-lived signed URLs issued after an access check.
 */
export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    taskId: uuid("task_id"),
    milestoneId: uuid("milestone_id"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storagePath: text("storage_path").notNull(),
    /** CLIENT = shared with the client portal. */
    visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
    isDeliverable: boolean("is_deliverable").notNull().default(false),
    status: attachmentStatusEnum("status").notNull().default("PENDING"),
    createdAt: createdAt(),
    deletedAt: tsCol("deleted_at"),
  },
  (t) => [
    foreignKey({
      name: "attachments_project_fk",
      columns: [t.organizationId, t.projectId],
      foreignColumns: [projects.organizationId, projects.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "attachments_task_fk",
      columns: [t.organizationId, t.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }),
    foreignKey({
      name: "attachments_milestone_fk",
      columns: [t.organizationId, t.milestoneId],
      foreignColumns: [milestones.organizationId, milestones.id],
    }),
    uniqueIndex("attachments_storage_path_unique").on(t.storagePath),
    index("attachments_project_idx").on(t.projectId, t.createdAt),
    index("attachments_task_idx").on(t.taskId),
    index("attachments_milestone_idx").on(t.milestoneId),
    check("attachments_size_positive", sql`${t.sizeBytes} > 0`),
    check("attachments_deliverable_shared", sql`not ${t.isDeliverable} or ${t.visibility} = 'CLIENT'`),
  ],
);
