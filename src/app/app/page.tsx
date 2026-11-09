import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, FileClock, FolderKanban, Plus, UsersRound } from "lucide-react";
import { BarSeriesChart } from "@/components/shared/charts";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, isOverdue, timeAgo } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { monthLabel } from "@/server/page";
import { getAgencyDashboard } from "@/server/services/analytics";
import { getOrganization } from "@/server/services/organizations";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireStaffPage();
  if (!isManager(ctx)) redirect("/app/my-work");
  const db = getDb();
  const [d, org] = await Promise.all([getAgencyDashboard(db, ctx), getOrganization(db, ctx)]);
  const isNew = d.stats.totalClients === 0 && d.stats.activeProjects === 0 && d.stats.completedProjects === 0;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${ctx.fullName.split(" ")[0]}`}
        description={`Here’s what’s happening across ${ctx.orgName}.`}
        actions={
          <Button asChild>
            <Link href="/app/projects/new">
              <Plus /> New project
            </Link>
          </Button>
        }
      />

      {isNew && (
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">Set up your workspace</p>
              <p className="mt-1 text-[13px] text-muted">Add your first client, create a project, then invite your team.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/clients/new">Add a client</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/team">Invite your team</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/app/settings">Workspace settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active projects" value={d.stats.activeProjects} icon={FolderKanban} href="/app/projects" />
        <StatCard label="Completed" value={d.stats.completedProjects} icon={CheckCircle2} tone="success" href="/app/projects?status=COMPLETED" />
        <StatCard label="Pending tasks" value={d.stats.pendingTasks} icon={ClipboardList} />
        <StatCard label="Overdue tasks" value={d.stats.overdueTasks} icon={AlertTriangle} tone={d.stats.overdueTasks ? "danger" : "neutral"} />
        <StatCard label="Awaiting approval" value={d.stats.pendingApprovals} icon={FileClock} tone={d.stats.pendingApprovals ? "warning" : "neutral"} />
        <StatCard label="Clients" value={d.stats.totalClients} icon={UsersRound} href="/app/clients" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects by status</CardTitle>
          </CardHeader>
          <CardContent>
            {d.statusDistribution.length ? (
              <BarSeriesChart
                title="Projects by status"
                layout="horizontal"
                data={d.statusDistribution.map((s) => ({ label: humanize(s.status), value: s.count }))}
              />
            ) : (
              <EmptyState icon={FolderKanban} title="No projects yet" description="Status breakdown appears once you create projects." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projects completed per month</CardTitle>
          </CardHeader>
          <CardContent>
            {d.completionSeries.some((p) => p.value > 0) ? (
              <BarSeriesChart title="Projects completed per month" data={d.completionSeries.map((p) => ({ label: monthLabel(p.month), value: p.value }))} />
            ) : (
              <EmptyState icon={CheckCircle2} title="No completed projects in the last 6 months" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue received</CardTitle>
          </CardHeader>
          <CardContent>
            {d.revenueSeries === null ? (
              <EmptyState icon={FileClock} title="Finance access required" description="Ask the owner to grant you finance access to see revenue." />
            ) : d.revenueSeries.some((p) => p.value > 0) ? (
              <BarSeriesChart
                title="Revenue received per month"
                kind="currency"
                currency={org.currency}
                data={d.revenueSeries.map((p) => ({ label: monthLabel(p.month), value: p.value }))}
              />
            ) : (
              <EmptyState icon={FileClock} title="No payments recorded yet" description="Record payments on invoices to see revenue here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
            <Link href="/app/projects" className="text-[13px] text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          {d.recentProjects.length ? (
            <ul className="divide-y divide-border">
              {d.recentProjects.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-[#fafbfc] sm:grid-cols-[1fr_120px_140px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted">{p.clientName}</p>
                    </div>
                    <StatusBadge status={p.status} className="justify-self-end sm:justify-self-start" />
                    <div className="hidden items-center gap-2 sm:flex">
                      <Progress value={p.progress} />
                      <span className="w-9 text-right text-xs text-muted tabular-nums">{p.progress}%</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              action={
                <Button asChild size="sm">
                  <Link href="/app/projects/new">Create a project</Link>
                </Button>
              }
            />
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending client approvals</CardTitle>
          </CardHeader>
          {d.pendingApprovals.length ? (
            <ul className="divide-y divide-border">
              {d.pendingApprovals.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <Link href={`/app/projects/${m.projectId}/milestones`} className="text-sm font-medium hover:underline">
                    {m.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {m.projectName} · submitted {m.submittedAt ? timeAgo(m.submittedAt) : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileClock} title="Nothing awaiting approval" />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          {d.upcomingTasks.length || d.upcomingMilestones.length ? (
            <ul className="divide-y divide-border">
              {d.upcomingMilestones.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <Link href={`/app/projects/${m.projectId}/milestones`} className="text-sm font-medium hover:underline">
                    Milestone: {m.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {m.projectName} · due {formatDate(m.dueDate)}
                  </p>
                </li>
              ))}
              {d.upcomingTasks.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <Link href={`/app/projects/${t.projectId}/tasks?task=${t.id}`} className="text-sm font-medium hover:underline">
                    {t.title}
                  </Link>
                  <p className={`text-xs ${isOverdue(t.dueDate, false) ? "text-danger" : "text-muted"}`}>
                    {t.projectName} · {isOverdue(t.dueDate, false) ? "overdue since" : "due"} {formatDate(t.dueDate)}
                    {t.assigneeName ? ` · ${t.assigneeName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="No deadlines in the next two weeks" />
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team workload</CardTitle>
            <Link href="/app/team" className="text-[13px] text-primary hover:underline">
              Team
            </Link>
          </CardHeader>
          <ul className="divide-y divide-border">
            {d.team.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={m.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.fullName}</p>
                  <p className="text-xs text-muted">
                    {m.openTasks} open · {m.overdueTasks} overdue · {m.hoursLast7Days}h this week
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          {d.recentActivity.length ? (
            <ul className="divide-y divide-border">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <p className="text-[13px]">{a.summary}</p>
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="No activity yet" />
          )}
        </Card>
      </div>
    </>
  );
}
