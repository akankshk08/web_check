import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/server/auth/session";
import type { AuthContext } from "@/server/auth/types";
import { AppError, isUniqueViolation } from "@/server/errors";

export type FieldErrors = Record<string, string[] | undefined>;
export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/** Converts any thrown error into a safe, user-facing result. Internal details are only logged. */
export function toActionError(err: unknown): { ok: false; error: string; fieldErrors?: FieldErrors } {
  unstable_rethrow(err); // let Next.js redirects / notFound propagate
  if (err instanceof z.ZodError) {
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors as FieldErrors };
  }
  if (err instanceof AppError) return { ok: false, error: err.message };
  if (isUniqueViolation(err)) return { ok: false, error: "That record already exists." };
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[action-error ${ref}]`, err);
  return { ok: false, error: `Something went wrong. Please try again. (ref ${ref})` };
}

/**
 * Wraps a server action. Server actions are public HTTP endpoints, so every one:
 *  1. resolves identity from the verified session (never from input),
 *  2. validates input with a strict Zod schema,
 *  3. returns safe errors.
 */
export function authedAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.infer<S>, ctx: AuthContext) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const ctx = await requireAuth();
      const input = schema.parse(raw);
      const data = await handler(input, ctx);
      return { ok: true, data };
    } catch (err) {
      return toActionError(err);
    }
  };
}

/** Same as authedAction for public endpoints (login, register...). */
export function publicAction<S extends z.ZodType, R>(schema: S, handler: (input: z.infer<S>) => Promise<R>) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const input = schema.parse(raw);
      const data = await handler(input);
      return { ok: true, data };
    } catch (err) {
      return toActionError(err);
    }
  };
}
