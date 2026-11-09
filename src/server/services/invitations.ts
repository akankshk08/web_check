import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "@/db";
import { clientMembers, clients, invitations, organizationMembers, organizations, users } from "@/db/schema";
import type { OrgRole } from "@/db/schema/enums";
import { assertManager, isOwner } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { appUrl, renderEmail, sendEmail } from "@/server/email";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";
import { notify } from "./notifications";

export const INVITATION_TTL_DAYS = 7;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type InvitationState = "valid" | "expired" | "accepted" | "revoked";

export function invitationState(inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InvitationState {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt <= now) return "expired";
  return "valid";
}

/** Creates an invitation and emails a single-use link. Only the token hash is stored. */
export async function createInvitation(
  db: Database,
  ctx: AuthContext,
  input: { email: string; role: Exclude<OrgRole, "OWNER">; clientId?: string },
) {
  assertManager(ctx);
  if (input.role === "ADMIN" && !isOwner(ctx)) throw new ForbiddenError("Only the owner can invite admins.");
  const email = input.email.toLowerCase();

  let clientName: string | null = null;
  if (input.role === "CLIENT") {
    if (!input.clientId) throw new BadRequestError("A client account is required.");
    const [client] = await db
      .select({ id: clients.id, name: clients.companyName, contact: clients.name })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, ctx.orgId), isNull(clients.archivedAt)))
      .limit(1);
    if (!client) throw new NotFoundError("Client not found.");
    clientName = client.name ?? client.contact;
  }

  const [existing] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(and(eq(organizationMembers.organizationId, ctx.orgId), eq(users.email, email), eq(organizationMembers.status, "ACTIVE")))
    .limit(1);
  if (existing && (input.role !== "CLIENT" || existing.role !== "CLIENT")) {
    throw new ConflictError("That person is already a member of this workspace.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await db.transaction(async (tx) => {
    // Revoke older pending invitations for the same person and role, so only the newest link works.
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.organizationId, ctx.orgId),
          eq(invitations.email, email),
          eq(invitations.role, input.role),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );
    const [inv] = await tx
      .insert(invitations)
      .values({
        organizationId: ctx.orgId,
        email,
        role: input.role,
        clientId: input.role === "CLIENT" ? input.clientId! : null,
        tokenHash: hashToken(token),
        invitedById: ctx.userId,
        expiresAt,
      })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "invitation",
      entityId: inv!.id,
      action: "created",
      summary: `${ctx.fullName} invited ${email} as ${input.role.toLowerCase()}`,
    });
    return inv!;
  });

  const link = `/invite/${token}`;
  const what = input.role === "CLIENT" ? `the ${clientName} client portal` : `the ${ctx.orgName} team`;
  await sendEmail({
    to: email,
    subject: `You're invited to join ${ctx.orgName} on AgencyOS`,
    html: renderEmail({
      heading: `Join ${what}`,
      body: `${ctx.fullName} invited you to ${what} on AgencyOS. This link expires in ${INVITATION_TTL_DAYS} days and can be used once.`,
      ctaLabel: "Accept invitation",
      ctaPath: link,
    }),
  });

  // Existing AgencyOS users also get an in-app notification.
  const [invitee] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (invitee) {
    await notify(db, {
      orgId: ctx.orgId,
      userIds: [invitee.id],
      type: "invitation",
      title: `You're invited to join ${ctx.orgName}`,
      body: `${ctx.fullName} invited you to ${what}.`,
      link,
      dedupeKey: `invitation:${invitation.id}`,
    });
  }

  return { invitation, token, url: appUrl(link) };
}

export async function getInvitationByToken(db: DbOrTx, token: string) {
  const [row] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      clientId: invitations.clientId,
      organizationId: invitations.organizationId,
      orgName: organizations.name,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      revokedAt: invitations.revokedAt,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return null;
  return { ...row, state: invitationState(row) };
}

/**
 * Accepts an invitation for a verified user. Locks the invitation row so a token
 * can never be used twice, and rejects expired/revoked tokens or a different email.
 */
export async function acceptInvitation(db: Database, input: { token: string; userId: string; email: string }) {
  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(input.token)))
      .for("update")
      .limit(1);
    if (!inv) throw new NotFoundError("This invitation link is invalid.");
    const state = invitationState(inv);
    if (state === "accepted") throw new BadRequestError("This invitation has already been used.");
    if (state === "revoked") throw new BadRequestError("This invitation was cancelled.");
    if (state === "expired") throw new BadRequestError("This invitation has expired. Ask for a new one.");
    if (inv.email !== input.email.toLowerCase()) {
      throw new ForbiddenError(`This invitation was sent to ${inv.email}. Sign in with that email to accept it.`);
    }

    const [member] = await tx
      .select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, inv.organizationId), eq(organizationMembers.userId, input.userId)))
      .limit(1);

    if (member && member.status === "ACTIVE") {
      if (inv.role === "CLIENT" && member.role !== "CLIENT") {
        throw new ConflictError("You are already a team member of this agency.");
      }
      if (inv.role !== "CLIENT" && member.role === "CLIENT") {
        throw new ConflictError("This account is a client portal user. Use a different email for team access.");
      }
      if (inv.role !== "CLIENT" && member.role !== inv.role && member.role !== "OWNER") {
        await tx.update(organizationMembers).set({ role: inv.role }).where(eq(organizationMembers.id, member.id));
      }
    } else if (member) {
      await tx
        .update(organizationMembers)
        .set({ status: "ACTIVE", role: inv.role, removedAt: null, canManageFinances: false })
        .where(eq(organizationMembers.id, member.id));
    } else {
      await tx.insert(organizationMembers).values({ organizationId: inv.organizationId, userId: input.userId, role: inv.role });
    }

    if (inv.role === "CLIENT" && inv.clientId) {
      await tx
        .insert(clientMembers)
        .values({ organizationId: inv.organizationId, clientId: inv.clientId, userId: input.userId })
        .onConflictDoNothing();
    }

    const updated = await tx
      .update(invitations)
      .set({ acceptedAt: new Date(), acceptedById: input.userId })
      .where(and(eq(invitations.id, inv.id), isNull(invitations.acceptedAt), gt(invitations.expiresAt, sql`now()`)))
      .returning({ id: invitations.id });
    if (updated.length === 0) throw new BadRequestError("This invitation is no longer valid.");

    await logActivity(tx, {
      orgId: inv.organizationId,
      actorId: input.userId,
      entityType: "invitation",
      entityId: inv.id,
      action: "accepted",
      summary: `${inv.email} joined as ${inv.role.toLowerCase()}`,
    });
    return { orgId: inv.organizationId, role: inv.role };
  });
}

export async function listPendingInvitations(db: DbOrTx, ctx: AuthContext, { clientId }: { clientId?: string } = {}) {
  assertManager(ctx);
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, ctx.orgId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, sql`now()`),
        clientId ? eq(invitations.clientId, clientId) : undefined,
      ),
    )
    .orderBy(desc(invitations.createdAt))
    .limit(100);
}

export async function revokeInvitation(db: DbOrTx, ctx: AuthContext, invitationId: string) {
  assertManager(ctx);
  const rows = await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, ctx.orgId), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id });
  if (rows.length === 0) throw new NotFoundError("Invitation not found.");
}
