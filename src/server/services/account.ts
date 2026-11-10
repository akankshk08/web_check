import { and, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { attachments, organizationMembers, organizations, users } from "@/db/schema";
import { BadRequestError } from "@/server/errors";

/**
 * Permanently deletes a user's AgencyOS data.
 *  - Owners of a workspace that still has other team members must transfer ownership first.
 *  - Owners who are the only team member: the whole workspace (clients, projects, invoices, files…) is deleted.
 *  - Everyone else: memberships, notifications and personal records are removed; content they wrote
 *    (comments, tasks they created) stays with the agency but is no longer linked to them.
 * Returns storage paths of files that must be removed from Storage after the transaction commits.
 */
export async function deleteAccountData(db: Database, userId: string): Promise<{ storagePaths: string[]; deletedOrgs: string[] }> {
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ orgId: organizationMembers.organizationId, orgName: organizations.name })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.role, "OWNER")));

    const deletedOrgs: string[] = [];
    for (const org of owned) {
      const [other] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, org.orgId),
            eq(organizationMembers.status, "ACTIVE"),
            ne(organizationMembers.userId, userId),
            ne(organizationMembers.role, "CLIENT"),
          ),
        )
        .limit(1);
      if (other) {
        throw new BadRequestError(`You own “${org.orgName}”, which has other team members. Transfer ownership in Settings first, then delete your account.`);
      }
      deletedOrgs.push(org.orgId);
    }

    const storagePaths = deletedOrgs.length
      ? (await tx.select({ path: attachments.storagePath }).from(attachments).where(inArray(attachments.organizationId, deletedOrgs))).map((r) => r.path)
      : [];
    if (deletedOrgs.length) {
      // Every organization-owned table cascades from organizations.
      await tx.delete(organizations).where(inArray(organizations.id, deletedOrgs));
    }
    // Memberships, client links, notifications, invitations sent and time entries cascade;
    // authored content keeps its text but loses the link to this person (ON DELETE SET NULL).
    await tx.delete(users).where(eq(users.id, userId));
    return { storagePaths, deletedOrgs };
  });
}
