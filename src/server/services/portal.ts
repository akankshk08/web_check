import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { attachments, invoices, milestones, projects } from "@/db/schema";
import { assertClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { effectiveInvoiceStatus } from "./invoices";

const NONE = ["00000000-0000-0000-0000-000000000000"];

/** Projects of the signed-in client user's client account(s). Never internal fields. */
export async function listPortalProjects(db: DbOrTx, ctx: AuthContext) {
  assertClient(ctx);
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      type: projects.type,
      progress: projects.progress,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
    })
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, ctx.orgId),
        inArray(projects.clientId, ctx.clientIds.length ? ctx.clientIds : NONE),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(desc(projects.updatedAt))
    .limit(100);
}

export async function getPortalDashboard(db: DbOrTx, ctx: AuthContext) {
  assertClient(ctx);
  const clientIds = ctx.clientIds.length ? ctx.clientIds : NONE;
  const projectScope = and(eq(projects.organizationId, ctx.orgId), inArray(projects.clientId, clientIds), isNull(projects.archivedAt));
  const [projectRows, upcoming, pending, deliverables, invoiceRows] = await Promise.all([
    listPortalProjects(db, ctx),
    db
      .select({ id: milestones.id, title: milestones.title, dueDate: milestones.dueDate, status: milestones.status, projectId: projects.id, projectName: projects.name })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(projectScope, isNull(milestones.deletedAt), ne(milestones.status, "APPROVED")))
      .orderBy(sql`${milestones.dueDate} asc nulls last`)
      .limit(6),
    db
      .select({ id: milestones.id, title: milestones.title, submittedAt: milestones.submittedAt, projectId: projects.id, projectName: projects.name })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(projectScope, isNull(milestones.deletedAt), eq(milestones.status, "SUBMITTED")))
      .orderBy(asc(milestones.submittedAt)),
    db
      .select({ id: attachments.id, fileName: attachments.fileName, createdAt: attachments.createdAt, projectId: projects.id, projectName: projects.name })
      .from(attachments)
      .innerJoin(projects, eq(projects.id, attachments.projectId))
      .where(
        and(projectScope, eq(attachments.visibility, "CLIENT"), eq(attachments.isDeliverable, true), eq(attachments.status, "READY"), isNull(attachments.deletedAt)),
      )
      .orderBy(desc(attachments.createdAt))
      .limit(5),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        dueDate: invoices.dueDate,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
        currency: invoices.currency,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, ctx.orgId),
          inArray(invoices.clientId, clientIds),
          inArray(invoices.status, ["SENT", "PARTIALLY_PAID", "OVERDUE"]),
          isNull(invoices.deletedAt),
        ),
      )
      .orderBy(asc(invoices.dueDate))
      .limit(10),
  ]);
  return {
    projects: projectRows,
    upcomingMilestones: upcoming,
    pendingApprovals: pending,
    recentDeliverables: deliverables,
    outstandingInvoices: invoiceRows.map((i) => ({ ...i, status: effectiveInvoiceStatus(i) })),
  };
}
