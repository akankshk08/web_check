import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ForbiddenError, UnauthenticatedError } from "@/server/errors";
import { loadAuthContext } from "./load-context";
import { canManageFinance, homePathFor, isClient, isManager, isStaff } from "./permissions";
import type { AuthContext } from "./types";

export const ACTIVE_ORG_COOKIE = "aos_org";

/** Verified Supabase user (token checked with Supabase Auth), or null. */
export const getSessionUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Auth context for the current request, or null when signed out / no profile. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value ?? null;
  return loadAuthContext(getDb(), user.id, preferred);
});

// ---------- Page guards (redirect) ----------

export async function requirePageAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.orgId) redirect("/no-workspace");
  return ctx;
}

export async function requireStaffPage(): Promise<AuthContext> {
  const ctx = await requirePageAuth();
  if (!isStaff(ctx)) redirect(homePathFor(ctx.role));
  return ctx;
}

export async function requireManagerPage(): Promise<AuthContext> {
  const ctx = await requirePageAuth();
  if (!isManager(ctx)) redirect(homePathFor(ctx.role));
  return ctx;
}

export async function requireClientPage(): Promise<AuthContext> {
  const ctx = await requirePageAuth();
  if (!isClient(ctx)) redirect(homePathFor(ctx.role));
  return ctx;
}

// ---------- Action / route guards (throw) ----------

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthenticatedError();
  if (!ctx.orgId) throw new ForbiddenError("You are not a member of any workspace.");
  return ctx;
}

export async function requireFinancePage(): Promise<AuthContext> {
  const ctx = await requirePageAuth();
  if (!canManageFinance(ctx)) redirect(homePathFor(ctx.role));
  return ctx;
}
