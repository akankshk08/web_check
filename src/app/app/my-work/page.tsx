import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckSquare, Clock, FolderKanban } from "lucide-react";
import { ProjectTable } from "@/components/projects/project-list";
import { PageHeader, StatCard } from "@/components/shared/page";
import { TaskList } from "@/components/tasks/task-board";
import { TaskDrawerLoader } from "@/components/tasks/task-drawer-loader";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";
import { getDb } from "@/db";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { sp } from "@/server/page";
import { getEmployeeDashboard } from "@/server/services/analytics";
import { listProjects } from "@/server/services/projects";
import { listMyTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "My work" };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const db = getDb();
  const [stats, tasks, projects] = await Promise.all([getEmployeeDashboard(db, ctx), listMyTasks(db, ctx), listProjects(db, ctx, { onlyMine: true })]);
  const rows = tasks.slice(0, 12).map((t) => ({ ...t, subtaskCount: 0 }));

  return (
    <>
      <PageHeader title="My work" description="Everything assigned to you, in one place." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Open tasks" value={stats.openTasks} icon={CheckSquare} href="/app/my-work/tasks" />
        <StatCard label="Overdue" value={stats.overdueTasks} icon={AlertTriangle} tone={stats.overdueTasks ? "danger" : "neutral"} />
        <StatCard label="Due this week" value={stats.dueThisWeek} icon={CalendarClock} tone={stats.dueThisWeek ? "warning" : "neutral"} href="/app/my-work/calendar" />
        <StatCard label="Active projects" value={stats.activeProjects} icon={FolderKanban} href="/app/my-work/projects" />
        <StatCard label="Hours (7 days)" value={stats.hoursThisWeek} icon={Clock} href="/app/my-work/timesheets" />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My open tasks</CardTitle>
          <Link href="/app/my-work/tasks" className="text-[13px] text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        {rows.length ? <TaskList tasks={rows} currentUserId={ctx.userId} isManager={isManager(ctx)} /> : <EmptyState icon={CheckSquare} title="You’re all caught up" description="No open tasks are assigned to you." />}
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My projects</CardTitle>
        </CardHeader>
        <ProjectTable rows={projects.rows} emptyTitle="You’re not on any projects yet" />
      </Card>
      <TaskDrawerLoader ctx={ctx} taskId={sp((await searchParams).task)} />
    </>
  );
}
