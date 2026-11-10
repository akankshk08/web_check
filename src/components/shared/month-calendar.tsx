import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/server/services/calendar";

const KIND_STYLE = {
  task: "border-l-primary bg-primary-soft/70",
  milestone: "border-l-[#E5A12B] bg-warning-soft",
  project: "border-l-[#DC5252] bg-danger-soft",
} as const;

export function parseMonth(value: string | undefined): { year: number; month: number } {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!m) return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  const month = Number(m[2]) - 1;
  return month >= 0 && month <= 11 ? { year: Number(m[1]), month } : { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function monthRange({ year, month }: { year: number; month: number }) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** Server-rendered month grid (Mon-Sun) with deadline chips. */
export function MonthCalendar({ year, month, events, basePath }: { year: number; month: number; events: CalendarEvent[]; basePath: string }) {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const today = new Date().toISOString().slice(0, 10);
  const prev = month === 0 ? iso(year - 1, 11) : iso(year, month - 1);
  const next = month === 11 ? iso(year + 1, 0) : iso(year, month + 1);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{first.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
        <div className="flex items-center gap-1">
          <Link href={`${basePath}?month=${prev}`} className="rounded-md p-1.5 hover:bg-subtle" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={basePath} className="rounded-md px-2 py-1 text-[13px] hover:bg-subtle">
            Today
          </Link>
          <Link href={`${basePath}?month=${next}`} className="rounded-md p-1.5 hover:bg-subtle" aria-label="Next month">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-border px-2 py-1.5 text-xs font-medium text-muted">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const inMonth = day >= 1 && day <= daysInMonth;
            const date = inMonth ? `${iso(year, month)}-${String(day).padStart(2, "0")}` : "";
            const items = inMonth ? (byDate.get(date) ?? []) : [];
            return (
              <div key={i} className={cn("min-h-[104px] border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-[#fafbfc]")}>
                {inMonth && (
                  <>
                    <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", date === today ? "bg-primary font-semibold text-white" : "text-muted")}>{day}</span>
                    <ul className="mt-1 flex flex-col gap-1">
                      {items.slice(0, 4).map((e) => (
                        <li key={`${e.kind}-${e.id}`}>
                          <Link
                            href={e.href}
                            title={e.sub ? `${e.title} — ${e.sub}` : e.title}
                            className={cn("block truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] hover:brightness-95", KIND_STYLE[e.kind], e.done && "line-through opacity-60")}
                          >
                            {e.title}
                          </Link>
                        </li>
                      ))}
                      {items.length > 4 && <li className="px-1 text-[11px] text-muted">+{items.length - 4} more</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded bg-primary" /> Task
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded bg-warning" /> Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded bg-danger" /> Project deadline
        </span>
      </div>
    </Card>
  );
}
