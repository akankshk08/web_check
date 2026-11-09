import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { clientMembers, clients, organizationMembers, organizations, users } from "@/db/schema";
import type { AuthContext } from "./types";

/**
 * Builds the auth context for an already-verified user id.
 * `preferredOrgId` (from a cookie) is only honoured if the user is an active member.
 */
export async function loadAuthContext(
  db: DbOrTx,
  userId: string,
  preferredOrgId?: string | null,
): Promise<AuthContext | null> {
  const [profile] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return null;

  const rows = await db
    .select({
      orgId: organizationMembers.organizationId,
      role: organizationMembers.role,
      canManageFinances: organizationMembers.canManageFinances,
      orgName: organizations.name,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, "ACTIVE"),
        isNull(organizations.deletedAt),
      ),
    )
    .orderBy(organizationMembers.joinedAt);

  const active = rows.find((r) => r.orgId === preferredOrgId) ?? rows[0];
  if (!active) {
    return {
      userId: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      orgId: "",
      orgName: "",
      role: "CLIENT",
      canManageFinances: false,
      clientIds: [],
      memberships: [],
    };
  }

  let clientIds: string[] = [];
  if (active.role === "CLIENT") {
    const cm = await db
      .select({ clientId: clientMembers.clientId })
      .from(clientMembers)
      .innerJoin(clients, eq(clients.id, clientMembers.clientId))
      .where(
        and(
          eq(clientMembers.userId, userId),
          eq(clientMembers.organizationId, active.orgId),
          isNull(clients.archivedAt),
        ),
      );
    clientIds = cm.map((c) => c.clientId);
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    orgId: active.orgId,
    orgName: active.orgName,
    role: active.role,
    canManageFinances: active.canManageFinances,
    clientIds,
    memberships: rows.map((r) => ({ orgId: r.orgId, orgName: r.orgName, role: r.role })),
  };
}

/** True when the user has no active organization (e.g. removed from every agency). */
export const hasNoOrganization = (ctx: AuthContext) => ctx.orgId === "";
