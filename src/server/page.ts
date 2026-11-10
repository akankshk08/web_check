import "server-only";
import { notFound } from "next/navigation";
import { ForbiddenError, isInvalidIdError, NotFoundError } from "@/server/errors";

/** Turns service "not found"/"forbidden" into the 404 page for server-rendered pages. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError || isInvalidIdError(err)) notFound();
    throw err;
  }
}

/** Reads a single string search param. */
export function sp(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length <= 200 ? v : undefined;
}

export function pickEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function pageNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}
