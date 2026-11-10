"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { appUrl } from "@/server/email";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import {
  acceptInviteSchema,
  acceptInviteSignupSchema,
  createWorkspaceSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { authedAction, publicAction } from "@/server/action";
import { loadAuthContext } from "@/server/auth/load-context";
import { homePathFor } from "@/server/auth/permissions";
import { ACTIVE_ORG_COOKIE, getSessionUser } from "@/server/auth/session";
import { BadRequestError, UnauthenticatedError } from "@/server/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { acceptInvitation, getInvitationByToken } from "@/server/services/invitations";
import { createAgencyForUser, ensureUserProfile } from "@/server/services/organizations";

const ORG_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

async function setActiveOrg(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, ORG_COOKIE_OPTIONS);
}

export const loginAction = publicAction(loginSchema.extend({ next: z.string().max(500).optional() }), async (input) => {
  const db = getDb();
  const ip = await clientIp();
  await enforceRateLimit(db, `login:ip:${ip}`, RATE_LIMITS.login.limit * 3, RATE_LIMITS.login.window);
  await enforceRateLimit(db, `login:email:${input.email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.window);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") throw new BadRequestError("Please confirm your email address first. Check your inbox.");
    throw new BadRequestError("Wrong email or password.");
  }
  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? input.email.split("@")[0]!;
  await ensureUserProfile(db, { id: data.user.id, email: data.user.email ?? input.email, fullName });
  // Invitation links must keep working for people who don't belong to a workspace yet.
  if (input.next?.startsWith("/invite/")) return { redirectTo: safeNextPath(input.next) };
  const ctx = await loadAuthContext(db, data.user.id, (await cookies()).get(ACTIVE_ORG_COOKIE)?.value);
  if (!ctx?.orgId) return { redirectTo: "/no-workspace" };
  const home = homePathFor(ctx.role);
  const next = safeNextPath(input.next, home);
  // Never send a client into the agency app or staff into the portal via ?next=.
  const allowed = ctx.role === "CLIENT" ? next.startsWith("/portal") : !next.startsWith("/portal");
  return { redirectTo: allowed ? next : home };
});

export const registerAction = publicAction(registerSchema, async (input) => {
  const db = getDb();
  await enforceRateLimit(db, `register:ip:${await clientIp()}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.window);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: appUrl("/auth/callback?next=/app"), data: { full_name: input.fullName } },
  });
  if (error) {
    if (error.code === "user_already_exists") throw new BadRequestError("An account with this email already exists. Try signing in.");
    if (error.code === "weak_password") throw new BadRequestError("Please choose a stronger password.");
    console.error("[register] signUp failed:", error.code);
    throw new BadRequestError("We couldn't create your account. Please try again.");
  }
  // Supabase hides existing accounts behind an identity-less user when email confirmation is on.
  if (!data.user || data.user.identities?.length === 0) return { needsConfirmation: true, redirectTo: "/check-email" };

  const org = await createAgencyForUser(db, { userId: data.user.id, email: input.email, fullName: input.fullName, agencyName: input.agencyName });
  if (!data.session) return { needsConfirmation: true, redirectTo: "/check-email" };
  await setActiveOrg(org.id);
  return { needsConfirmation: false, redirectTo: "/app" };
});

export const forgotPasswordAction = publicAction(forgotPasswordSchema, async (input) => {
  const db = getDb();
  await enforceRateLimit(db, `reset:ip:${await clientIp()}`, RATE_LIMITS.passwordReset.limit * 2, RATE_LIMITS.passwordReset.window);
  await enforceRateLimit(db, `reset:email:${input.email}`, RATE_LIMITS.passwordReset.limit, RATE_LIMITS.passwordReset.window);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: appUrl("/auth/callback?next=/reset-password") });
  if (error) console.error("[forgot-password]", error.code);
  // Same response whether or not the account exists.
  return null;
});

export const resetPasswordAction = publicAction(resetPasswordSchema, async (input) => {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError("Your reset link has expired. Request a new one.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    if (error.code === "same_password") throw new BadRequestError("Choose a password you haven't used before.");
    throw new BadRequestError("We couldn't update your password. Please request a new link.");
  }
  // Anyone signed in elsewhere with the old password is signed out.
  await supabase.auth.signOut({ scope: "others" });
  return { redirectTo: "/app" };
});

/** Signed-in user accepts an invitation sent to their email address. */
export const acceptInviteAction = publicAction(acceptInviteSchema, async (input) => {
  const user = await getSessionUser();
  if (!user?.email) throw new UnauthenticatedError();
  const db = getDb();
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email.split("@")[0]!;
  await ensureUserProfile(db, { id: user.id, email: user.email, fullName });
  const res = await acceptInvitation(db, { token: input.token, userId: user.id, email: user.email });
  await setActiveOrg(res.orgId);
  return { redirectTo: homePathFor(res.role) };
});

/** New user accepts an invitation by creating an account for the invited email. */
export const acceptInviteSignupAction = publicAction(acceptInviteSignupSchema, async (input) => {
  const db = getDb();
  await enforceRateLimit(db, `register:ip:${await clientIp()}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.window);
  const invitation = await getInvitationByToken(db, input.token);
  if (!invitation || invitation.state !== "valid") throw new BadRequestError("This invitation is no longer valid.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: invitation.email, // the invited address, never a user-supplied one
    password: input.password,
    options: { emailRedirectTo: appUrl("/auth/callback?next=/app"), data: { full_name: input.fullName } },
  });
  if (error?.code === "user_already_exists" || (data.user && data.user.identities?.length === 0)) {
    throw new BadRequestError("An account with this email already exists. Sign in to accept the invitation.");
  }
  if (error || !data.user) throw new BadRequestError("We couldn't create your account. Please try again.");

  await ensureUserProfile(db, { id: data.user.id, email: invitation.email, fullName: input.fullName });
  // Possessing the emailed token proves control of the address, so the invitation can be accepted now.
  const res = await acceptInvitation(db, { token: input.token, userId: data.user.id, email: invitation.email });
  if (!data.session) return { redirectTo: "/check-email" };
  await setActiveOrg(res.orgId);
  return { redirectTo: homePathFor(res.role) };
});

export const switchOrganizationAction = authedAction(z.object({ orgId: z.uuid() }).strict(), async (input, ctx) => {
  const membership = ctx.memberships.find((m) => m.orgId === input.orgId);
  if (!membership) throw new BadRequestError("Workspace not found.");
  await setActiveOrg(membership.orgId);
  return { redirectTo: homePathFor(membership.role) };
});

/** A signed-in user without a workspace (or wanting another one) creates an agency workspace. */
export const createWorkspaceAction = publicAction(createWorkspaceSchema, async (input) => {
  const user = await getSessionUser();
  if (!user?.email) throw new UnauthenticatedError();
  const db = getDb();
  await enforceRateLimit(db, `workspace:${user.id}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.window);
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email.split("@")[0]!;
  const org = await createAgencyForUser(db, { userId: user.id, email: user.email, fullName, agencyName: input.agencyName });
  await setActiveOrg(org.id);
  return { redirectTo: "/app" };
});
