import "server-only";
import { NextResponse } from "next/server";
import { AppError, isInvalidIdError } from "@/server/errors";

/** Safe JSON errors for route handlers: known errors keep their status, everything else is a 500 with a reference. */
export function routeError(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  if (isInvalidIdError(err)) return NextResponse.json({ error: "Not found.", code: "NOT_FOUND" }, { status: 404 });
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[route-error ${ref}]`, err);
  return NextResponse.json({ error: "Something went wrong.", ref }, { status: 500 });
}
