import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { serverEnv } from "@/lib/server-env";
import { pruneRateLimits } from "@/server/rate-limit";
import { routeError } from "@/server/route";
import { markOverdueInvoices } from "@/server/services/invoices";
import { sendDeadlineReminders } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${serverEnv().CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron (see vercel.json): deadline reminders + overdue invoice status. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = getDb();
    const [reminders, overdue] = [await sendDeadlineReminders(db), await markOverdueInvoices(db)];
    await pruneRateLimits(db);
    return NextResponse.json({ reminders, overdue });
  } catch (err) {
    return routeError(err);
  }
}
