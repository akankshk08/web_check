import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import type { Database, DbOrTx } from "@/db";
import { organizationMembers, organizations, users } from "@/db/schema";
import { slugify } from "@/lib/utils";
import type { z } from "zod";
import type { orgSettingsSchema, profileSchema } from "@/lib/validations/entities";
import { nn } from "@/lib/validations/common";
import { assertManager, assertOwner } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, NotFoundError } from "@/server/errors";
import { logActivity } from "./activity";

/** Creates the app profile for a Supabase Auth user if it does not exist yet. */
export async function ensureUserProfile(db: DbOrTx, input: { id: string; email: string; fullName: string }) {
  await db
    .insert(users)
    .values({ id: input.id, email: input.email.toLowerCase(), fullName: input.fullName })
    .onConflictDoNothing({ target: users.id });
}

/** Registration: profile + new agency workspace + OWNER membership, atomically. */
export async function createAgencyForUser(
  db: Database,
  input: { userId: string; email: string; fullName: string; agencyName: string },
) {
  return db.transaction(async (tx) => {
    await ensureUserProfile(tx, { id: input.userId, email: input.email, fullName: input.fullName });
    const slug = `${slugify(input.agencyName) || "agency"}-${randomBytes(3).toString("hex")}`;
    const [org] = await tx
      .insert(organizations)
      .values({ name: input.agencyName, slug, ownerId: input.userId, email: input.email.toLowerCase() })
      .returning();
    if (!org) throw new Error("Failed to create organization");
    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: input.userId,
      role: "OWNER",
      canManageFinances: true,
    });
    await logActivity(tx, {
      orgId: org.id,
      actorId: input.userId,
      entityType: "organization",
      entityId: org.id,
      action: "created",
      summary: `${input.fullName} created the ${input.agencyName} workspace`,
    });
    return org;
  });
}

export async function getOrganization(db: DbOrTx, ctx: AuthContext) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1);
  if (!org) throw new NotFoundError();
  return org;
}

export async function updateOrganization(db: Database, ctx: AuthContext, input: z.infer<typeof orgSettingsSchema>) {
  assertManager(ctx);
  await db.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        name: input.name,
        email: nn(input.email),
        phone: nn(input.phone),
        website: nn(input.website),
        address: nn(input.address),
        currency: input.currency,
        defaultTaxRate: input.defaultTaxRate,
        invoicePrefix: input.invoicePrefix.toUpperCase(),
      })
      .where(eq(organizations.id, ctx.orgId));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "organization",
      entityId: ctx.orgId,
      action: "updated",
      summary: `${ctx.fullName} updated workspace settings`,
    });
  });
}

export async function updateProfile(db: DbOrTx, ctx: AuthContext, input: z.infer<typeof profileSchema>) {
  await db
    .update(users)
    .set({ fullName: input.fullName, jobTitle: nn(input.jobTitle), phone: nn(input.phone) })
    .where(eq(users.id, ctx.userId));
}

/** Owner hands the organization to another active staff member and becomes an admin. */
export async function transferOwnership(db: Database, ctx: AuthContext, memberId: string) {
  assertOwner(ctx);
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, ctx.orgId),
          eq(organizationMembers.status, "ACTIVE"),
          ne(organizationMembers.userId, ctx.userId),
        ),
      )
      .limit(1);
    if (!target) throw new NotFoundError("Member not found.");
    if (target.role === "CLIENT") throw new BadRequestError("Ownership can only be transferred to a team member.");

    await tx
      .update(organizationMembers)
      .set({ role: "OWNER", canManageFinances: true })
      .where(eq(organizationMembers.id, target.id));
    await tx
      .update(organizationMembers)
      .set({ role: "ADMIN", canManageFinances: true })
      .where(and(eq(organizationMembers.organizationId, ctx.orgId), eq(organizationMembers.userId, ctx.userId)));
    await tx.update(organizations).set({ ownerId: target.userId }).where(eq(organizations.id, ctx.orgId));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "organization",
      entityId: ctx.orgId,
      action: "ownership_transferred",
      summary: `${ctx.fullName} transferred ownership of the workspace`,
      metadata: { toUserId: target.userId },
    });
  });
}
