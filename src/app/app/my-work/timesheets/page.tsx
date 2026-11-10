import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { BarSeriesChart } from "@/components/shared/charts";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { DeleteTimeEntryButton } from "@/components/tasks/delete-time-entry";
import { TimeEntryForm } from "@/components/tasks/time-entry-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { addDaysISO, formatDate } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { sp } from "@/server/page";
import { myDailyHours } from "@/server/services/analytics";
import { listProjectOptions } from "@/server/services/projects";
import { listMyTime } from "@/server/services/timesheets";

export const metadata: Metadata = { title: "Timesheets" };

/** Monday of the week containing `date` (YYYY-MM-DD). */
function weekStart(date?: string) {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? new Date(`${date}T00:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const from = weekStart(sp((await searchParams).week));
  const to = addDaysISO(6, new Date(`${from}T00:00:00Z`));
  const db = getDb();
  const [entries, daily, projects] = await Promise.all([listMyTime(db, ctx, { from, to }), myDailyHours(db, ctx, from, to), listProjectOptions(db, ctx)]);
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(i, new Date(`${from}T00:00:00Z`)));
  const chart = days.map((d) => ({ label: formatDate(d, "EEE d"), value: Number(daily.find((x) => x.day === d)?.hours ?? 0) }));

  return (
    <>
      <PageHeader title="Timesheets" description="Record the hours you work on each project." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Log time</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length ? <TimeEntryForm projects={projects} /> : <p className="text-[13px] text-muted">You need to be assigned to a project before you can log time.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link href={`/app/my-work/timesheets?week=${addDaysISO(-7, new Date(`${from}T00:00:00Z`))}`} className="rounded-md p-1 hover:bg-subtle" aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Link>
            <CardTitle>
              Week of {formatDate(from)} – {formatDate(to)}
            </CardTitle>
            <Link href={`/app/my-work/timesheets?week=${addDaysISO(7, new Date(`${from}T00:00:00Z`))}`} className="rounded-md p-1 hover:bg-subtle" aria-label="Next week">
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <span className="text-sm font-semibold tabular-nums">{total.toFixed(2)} h</span>
        </CardHeader>
        {entries.length ? (
          <>
            <CardContent>
              <BarSeriesChart title="Hours per day" data={chart} height={160} />
            </CardContent>
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Project</TH>
                  <TH>Task / note</TH>
                  <TH className="text-right">Hours</TH>
                  <TH className="w-10">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {entries.map((e) => (
                  <TR key={e.id}>
                    <TD className="text-muted">{formatDate(e.workDate, "EEE, MMM d")}</TD>
                    <TD>
                      <Link href={`/app/projects/${e.projectId}`} className="hover:underline">
                        {e.projectName}
                      </Link>
                    </TD>
                    <TD className="text-muted">{[e.taskTitle, e.description].filter(Boolean).join(" — ") || "—"}</TD>
                    <TD className="text-right tabular-nums">{Number(e.hours)}</TD>
                    <TD>
                      <DeleteTimeEntryButton id={e.id} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        ) : (
          <EmptyState icon={Clock} title="No time logged this week" />
        )}
      </Card>
    </>
  );
}
