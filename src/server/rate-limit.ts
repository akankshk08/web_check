import { sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { RateLimitError } from "@/server/errors";

/**
 * Fixed-window rate limit stored in Postgres, so it works across serverless instances.
 * Throws RateLimitError (429) when `limit` is exceeded within `windowSeconds`.
 */
export async function enforceRateLimit(db: DbOrTx, key: string, limit: number, windowSeconds: number) {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else rate_limits.window_start end
    returning count`);
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) throw new RateLimitError();
}

export const RATE_LIMITS = {
  login: { limit: 10, window: 15 * 60 },
  // Sign-ups per IP per hour. Override only for automated test runs (SIGNUP_RATE_LIMIT_PER_HOUR).
  register: { limit: Number(process.env.SIGNUP_RATE_LIMIT_PER_HOUR) || 5, window: 60 * 60 },
  passwordReset: { limit: 5, window: 60 * 60 },
  invite: { limit: 30, window: 60 * 60 },
  upload: { limit: 60, window: 10 * 60 },
  ticket: { limit: 10, window: 60 * 60 },
} as const;

/** Removes expired counters (called by the daily cron job). */
export async function pruneRateLimits(db: DbOrTx) {
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
}
