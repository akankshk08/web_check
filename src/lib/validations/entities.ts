import { z } from "zod";
import {
  clientStatusEnum,
  maintenanceStatusEnum,
  maintenanceTypeEnum,
  milestoneStatusEnum,
  paymentMethodEnum,
  priorityEnum,
  projectStatusEnum,
  projectTypeEnum,
  taskStatusEnum,
  ticketStatusEnum,
  visibilityEnum,
} from "@/db/schema/enums";
import {
  decimalString,
  email,
  optionalDate,
  optionalText,
  optionalUuid,
  requiredDate,
  requiredText,
  uuid,
} from "./common";

const dateOrder = <T extends { startDate: string; dueDate: string }>(d: T) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate;
const dateOrderMsg = { message: "Due date must be on or after the start date", path: ["dueDate"] };

// ---------- Clients ----------
export const clientSchema = z
  .object({
    name: requiredText("Contact name", 120),
    email,
    companyName: optionalText(160),
    phone: optionalText(40),
    address: optionalText(500),
    notes: optionalText(5000),
    status: z.enum(clientStatusEnum.enumValues),
  })
  .strict();
export const updateClientSchema = clientSchema.extend({ id: uuid }).strict();

// ---------- Projects ----------
const projectFields = {
    name: requiredText("Project name", 160),
    description: optionalText(5000),
    internalNotes: optionalText(5000),
    clientId: uuid,
    type: z.enum(projectTypeEnum.enumValues),
    status: z.enum(projectStatusEnum.enumValues),
    priority: z.enum(priorityEnum.enumValues),
    budget: decimalString("Budget", { allowEmpty: true }),
    startDate: optionalDate,
    dueDate: optionalDate,
    memberIds: z.array(uuid).max(50),
};
export const projectSchema = z.object(projectFields).strict().refine(dateOrder, dateOrderMsg);
export const updateProjectSchema = z.object({ id: uuid, ...projectFields }).strict().refine(dateOrder, dateOrderMsg);

// ---------- Milestones ----------
export const milestoneSchema = z
  .object({
    projectId: uuid,
    title: requiredText("Title", 160),
    description: optionalText(5000),
    dueDate: optionalDate,
  })
  .strict();
export const updateMilestoneSchema = z
  .object({
    id: uuid,
    title: requiredText("Title", 160),
    description: optionalText(5000),
    dueDate: optionalDate,
    status: z.enum(["NOT_STARTED", "IN_PROGRESS"] as const satisfies readonly (typeof milestoneStatusEnum.enumValues)[number][]),
  })
  .strict();
export const milestoneDecisionSchema = z
  .object({ milestoneId: uuid, comment: optionalText(5000) })
  .strict();
export const changeRequestSchema = z
  .object({ milestoneId: uuid, comment: requiredText("Feedback", 5000) })
  .strict();

// ---------- Tasks ----------
const taskFields = {
  title: requiredText("Title", 200),
  description: optionalText(10000),
  milestoneId: optionalUuid,
  assigneeId: optionalUuid,
  priority: z.enum(priorityEnum.enumValues),
  status: z.enum(taskStatusEnum.enumValues),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimatedHours: decimalString("Estimate", { allowEmpty: true, max: 9999 }),
};
export const taskSchema = z
  .object({ projectId: uuid, parentTaskId: optionalUuid, ...taskFields })
  .strict()
  .refine(dateOrder, dateOrderMsg);
export const updateTaskSchema = z.object({ id: uuid, ...taskFields }).strict().refine(dateOrder, dateOrderMsg);
export const taskStatusSchema = z
  .object({ id: uuid, status: z.enum(taskStatusEnum.enumValues), position: z.number().int().min(0).max(100000).optional() })
  .strict();
export const taskCommentSchema = z.object({ taskId: uuid, body: requiredText("Comment", 5000) }).strict();

// ---------- Comments ----------
export const projectCommentSchema = z
  .object({ projectId: uuid, body: requiredText("Message", 5000), visibility: z.enum(visibilityEnum.enumValues) })
  .strict();

// ---------- Team ----------
export const inviteMemberSchema = z.object({ email, role: z.enum(["ADMIN", "EMPLOYEE"]) }).strict();
export const inviteClientSchema = z.object({ clientId: uuid, email }).strict();
export const changeRoleSchema = z.object({ memberId: uuid, role: z.enum(["ADMIN", "EMPLOYEE"]) }).strict();
export const financeAccessSchema = z.object({ memberId: uuid, canManageFinances: z.boolean() }).strict();
export const memberIdSchema = z.object({ memberId: uuid }).strict();

// ---------- Time ----------
export const timeEntrySchema = z
  .object({
    projectId: uuid,
    taskId: optionalUuid,
    workDate: requiredDate,
    hours: decimalString("Hours", { max: 24 }).refine((v) => Number(v) > 0, "Hours must be greater than 0"),
    description: optionalText(1000),
  })
  .strict();

// ---------- Invoices ----------
export const invoiceItemSchema = z
  .object({
    description: requiredText("Description", 500),
    quantity: decimalString("Quantity", { max: 99_999_999 }).refine((v) => Number(v) > 0, "Quantity must be greater than 0"),
    unitPrice: decimalString("Unit price"),
  })
  .strict();
export const invoiceSchema = z
  .object({
    clientId: uuid,
    projectId: optionalUuid,
    issueDate: requiredDate,
    dueDate: requiredDate,
    taxRate: decimalString("Tax rate", { max: 100 }),
    notes: optionalText(5000),
    items: z.array(invoiceItemSchema).min(1, "Add at least one item").max(100),
  })
  .strict()
  .refine((d) => d.dueDate >= d.issueDate, { message: "Due date must be on or after the issue date", path: ["dueDate"] });
export const invoiceStatusSchema = z
  .object({ id: uuid, status: z.enum(["SENT", "CANCELLED", "DRAFT"]) })
  .strict();
export const paymentSchema = z
  .object({
    invoiceId: uuid,
    amount: decimalString("Amount").refine((v) => Number(v) > 0, "Amount must be greater than 0"),
    paidOn: requiredDate,
    method: z.enum(paymentMethodEnum.enumValues),
    reference: optionalText(120),
    notes: optionalText(1000),
  })
  .strict();

// ---------- Support ----------
export const ticketSchema = z
  .object({
    subject: requiredText("Subject", 200),
    description: requiredText("Description", 5000),
    projectId: optionalUuid,
    priority: z.enum(priorityEnum.enumValues),
  })
  .strict();
export const ticketUpdateSchema = z
  .object({ id: uuid, status: z.enum(ticketStatusEnum.enumValues), staffResponse: optionalText(5000) })
  .strict();

// ---------- Delivery & maintenance ----------
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full URL starting with https://");
export const deliverySchema = z
  .object({
    projectId: uuid,
    productionUrl: url,
    hostingProvider: optionalText(120),
    domainProvider: optionalText(120),
    domainExpiry: optionalDate,
    sslExpiry: optionalDate,
    deployedOn: optionalDate,
    handoverNotes: optionalText(10000),
  })
  .strict();
export const maintenanceSchema = z
  .object({
    projectId: uuid,
    type: z.enum(maintenanceTypeEnum.enumValues),
    title: requiredText("Title", 200),
    description: optionalText(5000),
    status: z.enum(maintenanceStatusEnum.enumValues),
    scheduledFor: optionalDate,
    completedOn: optionalDate,
    hours: decimalString("Hours", { allowEmpty: true, max: 9999 }),
  })
  .strict();
export const updateMaintenanceSchema = maintenanceSchema.extend({ id: uuid }).strict();

// ---------- Settings ----------
export const orgSettingsSchema = z
  .object({
    name: requiredText("Agency name", 120),
    email: z.union([email, z.literal("")]),
    phone: optionalText(40),
    website: url,
    address: optionalText(500),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
    defaultTaxRate: decimalString("Tax rate", { max: 100 }),
    invoicePrefix: z.string().trim().regex(/^[A-Z0-9-]{1,10}$/i, "Letters, numbers and dashes only (max 10)"),
  })
  .strict();
export const profileSchema = z
  .object({ fullName: requiredText("Name", 120), jobTitle: optionalText(120), phone: optionalText(40) })
  .strict();
export const transferOwnershipSchema = z.object({ memberId: uuid, confirm: z.literal("TRANSFER") }).strict();
