import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";

/** Safe JSON errors for route handlers: known errors keep their status, everything else is a 500 with a reference. */
export function routeError(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[route-error ${ref}]`, err);
  return NextResponse.json({ error: "Something went wrong.", ref }, { status: 500 });
}
