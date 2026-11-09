import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FolderKanban, Receipt, Wallet } from "lucide-react";
import { BarSeriesChart } from "@/components/shared/charts";
import { DateRangeFilter } from "@/components/shared/date-range";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { addDaysISO, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireManagerPage } from "@/server/auth/session";
import { monthLabel, sp } from "@/server/page";
import { getReports } from "@/server/services/analytics";
import { getOrganization } from "@/server/services/organizations";

export const metadata: Metadata = { title: "Reports" };

const validDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireManagerPage();
  const params = await searchParams;
  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  let from = validDate(sp(params.from)) ?? addDaysISO(-182);
  let to = validDate(sp(params.to)) ?? today;
  if (from > to) [from, to] = [to, from];
  // Cap the range at 3 years to keep queries cheap.
  if (Date.parse(to) - Date.parse(from) > 3 * 366 * 86400000) from = addDaysISO(-3 * 365, new Date(`${to}T00:00:00Z`));

  const db = getDb();
  const [r, org] = await Promise.all([getReports(db, ctx, { from, to }), getOrganization(db, ctx)]);
  const money = (v: string) => formatMoney(v, org.currency);

  return (
    <>
      <PageHeader title="Reports" description="Figures calculated from your workspace’s records for the selected period." />
      <Card className="mb-6 p-3">
        <DateRangeFilter
          from={from}
          to={to}
          presets={[
            { label: "Last 30 days", from: addDaysISO(-30), to: today },
            { label: "Last 6 months", from: addDaysISO(-182), to: today },
            { label: "This year", from: yearStart, to: today },
          ]}
        />
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active projects" value={r.summary.activeProjects} icon={FolderKanban} hint="Right now" />
        <StatCard label="Projects completed" value={r.summary.completedInRange} icon={CheckCircle2} tone="success" hint="In period" />
        <StatCard label="Overdue projects" value={r.summary.overdueProjects} icon={AlertTriangle} tone={r.summary.overdueProjects ? "danger" : "neutral"} hint="Right now" />
        <StatCard label="Hours logged" value={r.summary.hours} icon={Clock} hint="In period" />
        <StatCard label="Tasks completed" value={r.summary.tasksCompleted} icon={CheckCircle2} hint="In period" />
        <StatCard label="Tasks pending" value={r.summary.tasksPending} icon={ClipboardList} hint="Right now" />
        {r.summary.revenue !== null && <StatCard label="Revenue received" value={money(r.summary.revenue)} icon={Wallet} tone="success" hint="In period" />}
        {r.summary.outstanding !== null && <StatCard label="Outstanding invoices" value={money(r.summary.outstanding)} icon={Receipt} tone="warning" hint="Right now" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {r.revenueByMonth && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by month</CardTitle>
            </CardHeader>
            <CardContent>
              {r.revenueByMonth.some((p) => p.value > 0) ? (
                <BarSeriesChart title="Revenue by month" kind="currency" currency={org.currency} data={r.revenueByMonth.map((p) => ({ label: monthLabel(p.month), value: p.value }))} />
              ) : (
                <EmptyState icon={Wallet} title="No payments in this period" />
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Projects completed by month</CardTitle>
          </CardHeader>
          <CardContent>
            {r.completionTrend.some((p) => p.value > 0) ? (
              <BarSeriesChart title="Projects completed by month" data={r.completionTrend.map((p) => ({ label: monthLabel(p.month), value: p.value }))} />
            ) : (
              <EmptyState icon={CheckCircle2} title="No projects completed in this period" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasks completed by month</CardTitle>
          </CardHeader>
          <CardContent>
            {r.tasksTrend.some((p) => p.value > 0) ? (
              <BarSeriesChart title="Tasks completed by month" data={r.tasksTrend.map((p) => ({ label: monthLabel(p.month), value: p.value }))} />
            ) : (
              <EmptyState icon={ClipboardList} title="No tasks completed in this period" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Employee workload</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH className="text-right">Completed (period)</TH>
                <TH className="text-right">Open now</TH>
                <TH className="text-right">Hours (period)</TH>
              </tr>
            </THead>
            <TBody>
              {r.workload.map((w) => (
                <TR key={w.userId}>
                  <TD className="font-medium">{w.fullName}</TD>
                  <TD className="text-right tabular-nums">{w.completed}</TD>
                  <TD className="text-right tabular-nums">{w.open}</TD>
                  <TD className="text-right tabular-nums">{w.hours}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
