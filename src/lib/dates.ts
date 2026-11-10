import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function formatDate(value: string | Date | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : format(d, pattern);
}

export function timeAgo(value: Date | string): string {
  const d = typeof value === "string" ? parseISO(value) : value;
  return `${formatDistanceToNowStrict(d)} ago`;
}

/** Today's date as YYYY-MM-DD (UTC) for comparisons with Postgres `date` columns. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  return differenceInCalendarDays(parseISO(value), new Date());
}

export function isOverdue(dueDate: string | null | undefined, done: boolean): boolean {
  return !done && !!dueDate && dueDate < todayISO();
}
