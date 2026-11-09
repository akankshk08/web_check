"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { changeRoleSchema, financeAccessSchema, inviteMemberSchema, memberIdSchema, orgSettingsSchema, profileSchema, transferOwnershipSchema } from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { createInvitation } from "@/server/services/invitations";
import { transferOwnership, updateOrganization, updateProfile } from "@/server/services/organizations";
import { changeMemberRole, removeMember, setFinanceAccess } from "@/server/services/team";

export const inviteMemberAction = authedAction(inviteMemberSchema, async (input, ctx) => {
  const db = getDb();
  await enforceRateLimit(db, `invite:${ctx.orgId}`, RATE_LIMITS.invite.limit, RATE_LIMITS.invite.window);
  const { url } = await createInvitation(db, ctx, input);
  revalidatePath("/app/team");
  return { url };
});

export const changeRoleAction = authedAction(changeRoleSchema, async (input, ctx) => {
  await changeMemberRole(getDb(), ctx, input.memberId, input.role);
  revalidatePath("/app/team", "layout");
  return null;
});

export const financeAccessAction = authedAction(financeAccessSchema, async (input, ctx) => {
  await setFinanceAccess(getDb(), ctx, input.memberId, input.canManageFinances);
  revalidatePath("/app/team", "layout");
  return null;
});

export const removeMemberAction = authedAction(memberIdSchema, async (input, ctx) => {
  await removeMember(getDb(), ctx, input.memberId);
  revalidatePath("/app/team", "layout");
  return null;
});

export const updateOrganizationAction = authedAction(orgSettingsSchema, async (input, ctx) => {
  await updateOrganization(getDb(), ctx, input);
  revalidatePath("/app", "layout");
  return null;
});

export const updateProfileAction = authedAction(profileSchema, async (input, ctx) => {
  await updateProfile(getDb(), ctx, input);
  revalidatePath("/", "layout");
  return null;
});

export const transferOwnershipAction = authedAction(transferOwnershipSchema, async (input, ctx) => {
  await transferOwnership(getDb(), ctx, input.memberId);
  revalidatePath("/app", "layout");
  return null;
});
