import { and, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clients, projects, supportTickets, users } from "@/db/schema";
import type { TicketStatus } from "@/db/schema/enums";
import { nn } from "@/lib/validations/common";
import type { ticketSchema, ticketUpdateSchema } from "@/lib/validations/entities";
import { assertClient, assertStaff, isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { clientUserIds } from "./clients";
import { notify } from "./notifications";
import { managerUserIds } from "./projects";

export async function createTicket(db: Database, ctx: AuthContext, input: z.infer<typeof ticketSchema>) {
  assertClient(ctx);
  const clientId = ctx.clientIds[0];
  if (!clientId) throw new BadRequestError("Your account isn't linked to a client.");
  let ticketClientId = clientId;
  if (input.projectId) {
    const project = await getAccessibleProject(db, ctx, input.projectId, { allowClient: true });
    ticketClientId = project.clientId;
  }
  const ticket = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(supportTickets)
      .values({
        organizationId: ctx.orgId,
        clientId: ticketClientId,
        projectId: nn(input.projectId),
        createdById: ctx.userId,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
      })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ticket",
      entityId: t!.id,
      projectId: t!.projectId,
      action: "created",
      summary: `${ctx.fullName} opened a support ticket: ${input.subject}`,
    });
    return t!;
  });
  await notify(db, {
    orgId: ctx.orgId,
    userIds: await managerUserIds(db, ctx.orgId),
    actorId: ctx.userId,
    type: "ticket_created",
    title: `New support ticket: ${input.subject}`,
    body: input.description.slice(0, 300),
    link: `/app/clients/${ticketClientId}`,
    dedupeKey: `ticket-created:${ticket.id}`,
    email: true,
  });
  return ticket;
}

export async function listTickets(db: DbOrTx, ctx: AuthContext, { status, clientId }: { status?: TicketStatus; clientId?: string } = {}) {
  if (!isClient(ctx)) assertStaff(ctx);
  if (isClient(ctx) && ctx.clientIds.length === 0) return [];
  return db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      description: supportTickets.description,
      status: supportTickets.status,
      priority: supportTickets.priority,
      staffResponse: supportTickets.staffResponse,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      clientId: supportTickets.clientId,
      clientName: clients.companyName,
      projectName: projects.name,
      createdByName: users.fullName,
    })
    .from(supportTickets)
    .innerJoin(clients, eq(clients.id, supportTickets.clientId))
    .leftJoin(projects, eq(projects.id, supportTickets.projectId))
    .leftJoin(users, eq(users.id, supportTickets.createdById))
    .where(
      and(
        eq(supportTickets.organizationId, ctx.orgId),
        isClient(ctx) ? inArray(supportTickets.clientId, ctx.clientIds) : undefined,
        clientId ? eq(supportTickets.clientId, clientId) : undefined,
        status ? eq(supportTickets.status, status) : undefined,
      ),
    )
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);
}

export async function updateTicket(db: Database, ctx: AuthContext, input: z.infer<typeof ticketUpdateSchema>) {
  assertStaff(ctx);
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, input.id), eq(supportTickets.organizationId, ctx.orgId)))
    .limit(1);
  if (!ticket) throw new NotFoundError("Ticket not found.");
  const resolved = input.status === "RESOLVED" || input.status === "CLOSED";
  await db.transaction(async (tx) => {
    await tx
      .update(supportTickets)
      .set({ status: input.status, staffResponse: nn(input.staffResponse), resolvedAt: resolved ? (ticket.resolvedAt ?? new Date()) : null })
      .where(eq(supportTickets.id, ticket.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "ticket",
      entityId: ticket.id,
      action: "updated",
      summary: `${ctx.fullName} updated ticket "${ticket.subject}" to ${input.status.toLowerCase().replace("_", " ")}`,
    });
  });
  await notify(db, {
    orgId: ctx.orgId,
    userIds: await clientUserIds(db, ctx.orgId, ticket.clientId),
    actorId: ctx.userId,
    type: "ticket_updated",
    title: `Support ticket updated: ${ticket.subject}`,
    body: input.staffResponse ? input.staffResponse.slice(0, 300) : `Status: ${input.status.toLowerCase().replace("_", " ")}`,
    link: "/portal/support",
    dedupeKey: `ticket-updated:${ticket.id}:${Date.now()}`,
  });
}
