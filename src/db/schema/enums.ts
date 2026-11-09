import { pgEnum } from "drizzle-orm/pg-core";

export const orgRoleEnum = pgEnum("org_role", ["OWNER", "ADMIN", "EMPLOYEE", "CLIENT"]);
export const memberStatusEnum = pgEnum("member_status", ["ACTIVE", "REMOVED"]);
export const clientStatusEnum = pgEnum("client_status", ["LEAD", "ACTIVE", "INACTIVE"]);
export const projectStatusEnum = pgEnum("project_status", [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "IN_REVIEW",
  "COMPLETED",
  "CANCELLED",
]);
export const projectTypeEnum = pgEnum("project_type", [
  "WEBSITE",
  "WEB_APP",
  "ECOMMERCE",
  "MOBILE_APP",
  "BRANDING",
  "MAINTENANCE",
  "OTHER",
]);
export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const milestoneStatusEnum = pgEnum("milestone_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "APPROVED",
]);
export const approvalActionEnum = pgEnum("approval_action", ["SUBMITTED", "APPROVED", "CHANGES_REQUESTED", "FEEDBACK"]);
export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "COMPLETED",
  "CANCELLED",
]);
export const visibilityEnum = pgEnum("visibility", ["INTERNAL", "CLIENT"]);
export const attachmentStatusEnum = pgEnum("attachment_status", ["PENDING", "READY"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["BANK_TRANSFER", "CARD", "CASH", "CHEQUE", "OTHER"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const maintenanceTypeEnum = pgEnum("maintenance_type", [
  "UPDATE",
  "BACKUP",
  "SECURITY",
  "BUGFIX",
  "CONTENT",
  "OTHER",
]);
export const maintenanceStatusEnum = pgEnum("maintenance_status", ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type ClientStatus = (typeof clientStatusEnum.enumValues)[number];
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type ProjectType = (typeof projectTypeEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type MilestoneStatus = (typeof milestoneStatusEnum.enumValues)[number];
export type ApprovalAction = (typeof approvalActionEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type Visibility = (typeof visibilityEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type MaintenanceType = (typeof maintenanceTypeEnum.enumValues)[number];
export type MaintenanceStatus = (typeof maintenanceStatusEnum.enumValues)[number];
