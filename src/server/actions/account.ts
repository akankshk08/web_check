"use server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changePasswordSchema, deleteAccountSchema, resendConfirmationSchema } from "@/lib/validations/auth";
import { publicAction } from "@/server/action";
import { ACTIVE_ORG_COOKIE, getSessionUser } from "@/server/auth/session";
import { appUrl } from "@/server/email";
import { BadRequestError, UnauthenticatedError } from "@/server/errors";
import { log } from "@/server/log";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { deleteAccountData } from "@/server/services/account";
import { supabaseStorage } from "@/server/storage";

/** Re-checks the password without touching the browser session (separate, non-persisted client). */
async function verifyPassword(email: string, password: string) {
  const env = publicEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new BadRequestError("Your current password is incorrect.");
  await client.auth.signOut({ scope: "local" });
}

async function requireUser() {
  const user = await getSessionUser();
  if (!user?.email) throw new UnauthenticatedError();
  await enforceRateLimit(getDb(), `reauth:${user.id}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.window);
  return { id: user.id, email: user.email };
}

export const changePasswordAction = publicAction(changePasswordSchema, async (input) => {
  const user = await requireUser();
  await verifyPassword(user.email, input.currentPassword);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) throw new BadRequestError("We couldn't update your password. Please try again.");
  // Sign out every other device that was using the old password.
  await supabase.auth.signOut({ scope: "others" });
  log.info("password_changed", { userId: user.id });
  return null;
});

export const deleteAccountAction = publicAction(deleteAccountSchema, async (input) => {
  const user = await requireUser();
  await verifyPassword(user.email, input.password);
  const { storagePaths, deletedOrgs } = await deleteAccountData(getDb(), user.id);
  if (storagePaths.length) {
    const storage = supabaseStorage();
    for (let i = 0; i < storagePaths.length; i += 100) await storage.remove(storagePaths.slice(i, i + 100));
  }
  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
  if (error) log.error("auth_user_delete_failed", { userId: user.id, code: error.code });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  log.info("account_deleted", { userId: user.id, workspacesDeleted: deletedOrgs.length, filesRemoved: storagePaths.length });
  return { redirectTo: "/login?deleted=1" };
});

export const resendConfirmationAction = publicAction(resendConfirmationSchema, async (input) => {
  const db = getDb();
  await enforceRateLimit(db, `resend:ip:${await clientIp()}`, 6, 60 * 60);
  await enforceRateLimit(db, `resend:email:${input.email}`, 3, 60 * 60);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: input.email, options: { emailRedirectTo: appUrl("/auth/callback?next=/app") } });
  if (error) log.warn("resend_confirmation_failed", { code: error.code });
  // Same answer whether or not the account exists.
  return null;
});
