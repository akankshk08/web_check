import { relations } from "drizzle-orm";
import { invoiceItems, invoices, payments } from "./billing";
import { clientMembers, clients } from "./clients";
import { attachments } from "./files";
import {
  activityLogs,
  maintenanceRecords,
  notifications,
  projectDeliveries,
  supportTickets,
} from "./operations";
import { invitations, organizationMembers, organizations, users } from "./organizations";
import { milestoneApprovals, milestones, projectMembers, projects } from "./projects";
import { projectComments, taskComments, tasks, timeEntries } from "./tasks";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  clientMemberships: many(clientMembers),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  members: many(organizationMembers),
  clients: many(clients),
  projects: many(projects),
  invitations: many(invitations),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, { fields: [organizationMembers.organizationId], references: [organizations.id] }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, { fields: [invitations.organizationId], references: [organizations.id] }),
  client: one(clients, { fields: [invitations.clientId], references: [clients.id] }),
  invitedBy: one(users, { fields: [invitations.invitedById], references: [users.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, { fields: [clients.organizationId], references: [organizations.id] }),
  members: many(clientMembers),
  projects: many(projects),
  invoices: many(invoices),
  tickets: many(supportTickets),
}));

export const clientMembersRelations = relations(clientMembers, ({ one }) => ({
  client: one(clients, { fields: [clientMembers.clientId], references: [clients.id] }),
  user: one(users, { fields: [clientMembers.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.organizationId], references: [organizations.id] }),
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  members: many(projectMembers),
  milestones: many(milestones),
  tasks: many(tasks),
  comments: many(projectComments),
  attachments: many(attachments),
  delivery: one(projectDeliveries, { fields: [projects.id], references: [projectDeliveries.projectId] }),
  maintenance: many(maintenanceRecords),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  approvals: many(milestoneApprovals),
  tasks: many(tasks),
  attachments: many(attachments),
}));

export const milestoneApprovalsRelations = relations(milestoneApprovals, ({ one }) => ({
  milestone: one(milestones, { fields: [milestoneApprovals.milestoneId], references: [milestones.id] }),
  actor: one(users, { fields: [milestoneApprovals.actorId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  parent: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id], relationName: "subtasks" }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  comments: many(taskComments),
  attachments: many(attachments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
  author: one(users, { fields: [taskComments.authorId], references: [users.id] }),
}));

export const projectCommentsRelations = relations(projectComments, ({ one }) => ({
  project: one(projects, { fields: [projectComments.projectId], references: [projects.id] }),
  author: one(users, { fields: [projectComments.authorId], references: [users.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  project: one(projects, { fields: [timeEntries.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [timeEntries.taskId], references: [tasks.id] }),
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  project: one(projects, { fields: [attachments.projectId], references: [projects.id] }),
  task: one(tasks, { fields: [attachments.taskId], references: [tasks.id] }),
  milestone: one(milestones, { fields: [attachments.milestoneId], references: [milestones.id] }),
  uploadedBy: one(users, { fields: [attachments.uploadedById], references: [users.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  actor: one(users, { fields: [activityLogs.actorId], references: [users.id] }),
  project: one(projects, { fields: [activityLogs.projectId], references: [projects.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  client: one(clients, { fields: [supportTickets.clientId], references: [clients.id] }),
  project: one(projects, { fields: [supportTickets.projectId], references: [projects.id] }),
  createdBy: one(users, { fields: [supportTickets.createdById], references: [users.id] }),
}));

export const projectDeliveriesRelations = relations(projectDeliveries, ({ one }) => ({
  project: one(projects, { fields: [projectDeliveries.projectId], references: [projects.id] }),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  project: one(projects, { fields: [maintenanceRecords.projectId], references: [projects.id] }),
  performedBy: one(users, { fields: [maintenanceRecords.performedById], references: [users.id] }),
}));
