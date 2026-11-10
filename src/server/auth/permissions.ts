import type { OrgRole } from "@/db/schema/enums";
import { ForbiddenError } from "@/server/errors";
import type { AuthContext } from "./types";

export const STAFF_ROLES: OrgRole[] = ["OWNER", "ADMIN", "EMPLOYEE"];
export const MANAGER_ROLES: OrgRole[] = ["OWNER", "ADMIN"];

export const isStaff = (ctx: Pick<AuthContext, "role">) => STAFF_ROLES.includes(ctx.role);
export const isManager = (ctx: Pick<AuthContext, "role">) => MANAGER_ROLES.includes(ctx.role);
export const isOwner = (ctx: Pick<AuthContext, "role">) => ctx.role === "OWNER";
export const isClient = (ctx: Pick<AuthContext, "role">) => ctx.role === "CLIENT";
/** Owners always; admins only when the owner granted finance access. */
export const canManageFinance = (ctx: Pick<AuthContext, "role" | "canManageFinances">) =>
  ctx.role === "OWNER" || (ctx.role === "ADMIN" && ctx.canManageFinances);

export function assertStaff(ctx: AuthContext) {
  if (!isStaff(ctx)) throw new ForbiddenError();
}
export function assertManager(ctx: AuthContext) {
  if (!isManager(ctx)) throw new ForbiddenError("Only owners and admins can do that.");
}
export function assertOwner(ctx: AuthContext) {
  if (!isOwner(ctx)) throw new ForbiddenError("Only the organization owner can do that.");
}
export function assertFinance(ctx: AuthContext) {
  if (!canManageFinance(ctx)) throw new ForbiddenError("You don't have access to finances.");
}
export function assertClient(ctx: AuthContext) {
  if (!isClient(ctx)) throw new ForbiddenError();
}

/** Where a user lands after signing in. */
export function homePathFor(role: OrgRole): string {
  if (role === "CLIENT") return "/portal";
  if (role === "EMPLOYEE") return "/app/my-work";
  return "/app";
}
