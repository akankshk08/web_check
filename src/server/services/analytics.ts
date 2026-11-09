import { and, asc, desc, eq, gte, inArray, isNull, lte, notInArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { activityLogs, clients, milestones, projects, tasks, timeEntries, users } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { assertManager, canManageFinance } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { listTeam } from "./team";

type MonthRow = { month: string; value: string };

/** Fills a monthly series between two dates (inclusive) in SQL so empty months show as 0. */
async function monthlySeries(db: DbOrTx, from: string, to: string, valuesSql: ReturnType<typeof sql>): Promise<MonthRow[]> {
  const rows = await db.execute<MonthRow>(sql`
    with months as (
      select to_char(m, 'YYYY-MM') as month
      from generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), interval '1 month') m
    ), vals as (${valuesSql})
    select months.month, coalesce(vals.value, 0)::text as value
    from months left join vals on vals.month = months.month
    order by months.month`);
  return [...rows];
}

export async function getAgencyDashboard(db: DbOrTx, ctx: AuthContext) {
  assertManager(ctx);
  const org = ctx.orgId;
  const today = todayISO();
  const sixMonthsAgo = addDaysISO(-182);

  const [stats] = await db.execute<{
    active_projects: number;
    completed_projects: number;
    pending_tasks: number;
    overdue_tasks: number;
    pending_approvals: number;
    total_clients: number;
  }>(sql`
    select
      (select count(*)::int from projects where organization_id = ${org} and archived_at is null and status not in ('COMPLETED','CANCELLED')) as active_projects,
      (select count(*)::int from projects where organization_id = ${org} and archived_at is null and status = 'COMPLETED') as completed_projects,
      (select count(*)::int from tasks where organization_id = ${org} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED')) as pending_tasks,
      (select count(*)::int from tasks where organization_id = ${org} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED') and due_date < ${today}) as overdue_tasks,
      (select count(*)::int from milestones where organization_id = ${org} and deleted_at is null and status = 'SUBMITTED') as pending_approvals,
      (select count(*)::int from clients where organization_id = ${org} and archived_at is null) as total_clients`);

  const [statusDistribution, completionSeries, revenueSeries, recentActivity, upcomingTasks, upcomingMilestones, recentProjects, pendingApprovals, team] =
    await Promise.all([
      db
        .select({ status: projects.status, count: sql<number>`count(*)::int` })
        .from(projects)
        .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt)))
        .groupBy(projects.status),
      monthlySeries(
        db,
        sixMonthsAgo,
        today,
        sql`select to_char(completed_at, 'YYYY-MM') as month, count(*) as value from projects
            where organization_id = ${org} and status = 'COMPLETED' and completed_at >= ${sixMonthsAgo}::date group by 1`,
      ),
      canManageFinance(ctx)
        ? monthlySeries(
            db,
            sixMonthsAgo,
            today,
            sql`select to_char(paid_on, 'YYYY-MM') as month, sum(amount) as value from payments
                where organization_id = ${org} and paid_on >= ${sixMonthsAgo}::date group by 1`,
          )
        : Promise.resolve(null),
      db
        .select({ id: activityLogs.id, summary: activityLogs.summary, createdAt: activityLogs.createdAt, projectId: activityLogs.projectId, actorName: users.fullName })
        .from(activityLogs)
        .leftJoin(users, eq(users.id, activityLogs.actorId))
        .where(eq(activityLogs.organizationId, org))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10),
      db
        .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectId: tasks.projectId, projectName: projects.name, assigneeName: users.fullName })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(users, eq(users.id, tasks.assigneeId))
        .where(
          and(
            eq(tasks.organizationId, org),
            isNull(tasks.archivedAt),
            isNull(projects.archivedAt),
            notInArray(tasks.status, ["COMPLETED", "CANCELLED"]),
            lte(tasks.dueDate, addDaysISO(14)),
          ),
        )
        .orderBy(asc(tasks.dueDate))
        .limit(8),
      db
        .select({ id: milestones.id, title: milestones.title, dueDate: milestones.dueDate, projectId: milestones.projectId, projectName: projects.name })
        .from(milestones)
        .innerJoin(projects, eq(projects.id, milestones.projectId))
        .where(
          and(
            eq(milestones.organizationId, org),
            isNull(milestones.deletedAt),
            isNull(projects.archivedAt),
            notInArray(milestones.status, ["APPROVED"]),
            gte(milestones.dueDate, today),
            lte(milestones.dueDate, addDaysISO(30)),
          ),
        )
        .orderBy(asc(milestones.dueDate))
        .limit(5),
      db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          progress: projects.progress,
          dueDate: projects.dueDate,
          clientName: sql<string>`coalesce(${clients.companyName}, ${clients.name})`,
        })
        .from(projects)
        .innerJoin(clients, eq(clients.id, projects.clientId))
        .where(and(eq(projects.organizationId, org), isNull(projects.archivedAt)))
        .orderBy(desc(projects.updatedAt))
        .limit(5),
      db
        .select({ id: milestones.id, title: milestones.title, submittedAt: milestones.submittedAt, projectId: projects.id, projectName: projects.name })
        .from(milestones)
        .innerJoin(projects, eq(projects.id, milestones.projectId))
        .where(and(eq(milestones.organizationId, org), eq(milestones.status, "SUBMITTED"), isNull(milestones.deletedAt)))
        .orderBy(asc(milestones.submittedAt))
        .limit(5),
      listTeam(db, ctx),
    ]);

  return {
    stats: {
      activeProjects: stats?.active_projects ?? 0,
      completedProjects: stats?.completed_projects ?? 0,
      pendingTasks: stats?.pending_tasks ?? 0,
      overdueTasks: stats?.overdue_tasks ?? 0,
      pendingApprovals: stats?.pending_approvals ?? 0,
      totalClients: stats?.total_clients ?? 0,
    },
    statusDistribution,
    completionSeries: completionSeries.map((r) => ({ month: r.month, value: Number(r.value) })),
    revenueSeries: revenueSeries?.map((r) => ({ month: r.month, value: Number(r.value) })) ?? null,
    recentActivity,
    upcomingTasks,
    upcomingMilestones,
    recentProjects,
    pendingApprovals,
    team,
  };
}

/** Reports page with a date range. All figures are computed from database records. */
export async function getReports(db: DbOrTx, ctx: AuthContext, { from, to }: { from: string; to: string }) {
  assertManager(ctx);
  const org = ctx.orgId;
  const today = todayISO();
  const [summary] = await db.execute<{
    active: number;
    completed_in_range: number;
    overdue_projects: number;
    tasks_completed: number;
    tasks_pending: number;
    outstanding: string;
    revenue: string;
    hours: string;
  }>(sql`
    select
      (select count(*)::int from projects where organization_id = ${org} and archived_at is null and status not in ('COMPLETED','CANCELLED')) as active,
      (select count(*)::int from projects where organization_id = ${org} and status = 'COMPLETED' and completed_at::date between ${from} and ${to}) as completed_in_range,
      (select count(*)::int from projects where organization_id = ${org} and archived_at is null and status not in ('COMPLETED','CANCELLED') and due_date < ${today}) as overdue_projects,
      (select count(*)::int from tasks where organization_id = ${org} and archived_at is null and status = 'COMPLETED' and completed_at::date between ${from} and ${to}) as tasks_completed,
      (select count(*)::int from tasks where organization_id = ${org} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED')) as tasks_pending,
      (select coalesce(sum(total - amount_paid),0)::text from invoices where organization_id = ${org} and deleted_at is null and status in ('SENT','PARTIALLY_PAID','OVERDUE')) as outstanding,
      (select coalesce(sum(amount),0)::text from payments where organization_id = ${org} and paid_on between ${from} and ${to}) as revenue,
      (select coalesce(sum(hours),0)::text from time_entries where organization_id = ${org} and work_date between ${from} and ${to}) as hours`);

  const finance = canManageFinance(ctx);
  const [revenueByMonth, completionTrend, tasksTrend, workload] = await Promise.all([
    finance
      ? monthlySeries(db, from, to, sql`select to_char(paid_on,'YYYY-MM') as month, sum(amount) as value from payments where organization_id = ${org} and paid_on between ${from} and ${to} group by 1`)
      : Promise.resolve(null),
    monthlySeries(db, from, to, sql`select to_char(completed_at,'YYYY-MM') as month, count(*) as value from projects where organization_id = ${org} and status = 'COMPLETED' and completed_at::date between ${from} and ${to} group by 1`),
    monthlySeries(db, from, to, sql`select to_char(completed_at,'YYYY-MM') as month, count(*) as value from tasks where organization_id = ${org} and status = 'COMPLETED' and archived_at is null and completed_at::date between ${from} and ${to} group by 1`),
    db
      .select({
        userId: users.id,
        fullName: users.fullName,
        completed: sql<number>`(select count(*)::int from tasks t where t.assignee_id = ${users.id} and t.organization_id = ${org} and t.status = 'COMPLETED' and t.completed_at::date between ${from} and ${to})`,
        open: sql<number>`(select count(*)::int from tasks t where t.assignee_id = ${users.id} and t.organization_id = ${org} and t.archived_at is null and t.status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED'))`,
        hours: sql<string>`(select coalesce(sum(e.hours),0)::text from time_entries e where e.user_id = ${users.id} and e.organization_id = ${org} and e.work_date between ${from} and ${to})`,
      })
      .from(users)
      .where(
        inArray(
          users.id,
          sql`(select user_id from organization_members where organization_id = ${org} and status = 'ACTIVE' and role <> 'CLIENT')`,
        ),
      )
      .orderBy(users.fullName),
  ]);

  return {
    summary: {
      activeProjects: summary?.active ?? 0,
      completedInRange: summary?.completed_in_range ?? 0,
      overdueProjects: summary?.overdue_projects ?? 0,
      tasksCompleted: summary?.tasks_completed ?? 0,
      tasksPending: summary?.tasks_pending ?? 0,
      outstanding: finance ? (summary?.outstanding ?? "0") : null,
      revenue: finance ? (summary?.revenue ?? "0") : null,
      hours: Number(summary?.hours ?? 0),
    },
    revenueByMonth: revenueByMonth?.map((r) => ({ month: r.month, value: Number(r.value) })) ?? null,
    completionTrend: completionTrend.map((r) => ({ month: r.month, value: Number(r.value) })),
    tasksTrend: tasksTrend.map((r) => ({ month: r.month, value: Number(r.value) })),
    workload: workload.map((w) => ({ ...w, hours: Number(w.hours) })),
  };
}

/** Employee home: my tasks, deadlines and hours. */
export async function getEmployeeDashboard(db: DbOrTx, ctx: AuthContext) {
  const today = todayISO();
  const weekAgo = addDaysISO(-6);
  const [stats] = await db.execute<{ open: number; overdue: number; due_week: number; projects: number; hours: string }>(sql`
    select
      (select count(*)::int from tasks where organization_id = ${ctx.orgId} and assignee_id = ${ctx.userId} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED')) as open,
      (select count(*)::int from tasks where organization_id = ${ctx.orgId} and assignee_id = ${ctx.userId} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED') and due_date < ${today}) as overdue,
      (select count(*)::int from tasks where organization_id = ${ctx.orgId} and assignee_id = ${ctx.userId} and archived_at is null and status in ('TODO','IN_PROGRESS','IN_REVIEW','CHANGES_REQUESTED') and due_date between ${today} and ${addDaysISO(7)}) as due_week,
      (select count(*)::int from project_members pm join projects p on p.id = pm.project_id where pm.user_id = ${ctx.userId} and p.organization_id = ${ctx.orgId} and p.archived_at is null and p.status not in ('COMPLETED','CANCELLED')) as projects,
      (select coalesce(sum(hours),0)::text from time_entries where organization_id = ${ctx.orgId} and user_id = ${ctx.userId} and work_date >= ${weekAgo}) as hours`);
  return {
    openTasks: stats?.open ?? 0,
    overdueTasks: stats?.overdue ?? 0,
    dueThisWeek: stats?.due_week ?? 0,
    activeProjects: stats?.projects ?? 0,
    hoursThisWeek: Number(stats?.hours ?? 0),
  };
}

/** Hours logged per day for the current user (timesheet chart). */
export async function myDailyHours(db: DbOrTx, ctx: AuthContext, from: string, to: string) {
  return db
    .select({ day: timeEntries.workDate, hours: sql<string>`sum(${timeEntries.hours})::text` })
    .from(timeEntries)
    .where(and(eq(timeEntries.organizationId, ctx.orgId), eq(timeEntries.userId, ctx.userId), gte(timeEntries.workDate, from), lte(timeEntries.workDate, to)))
    .groupBy(timeEntries.workDate)
    .orderBy(timeEntries.workDate);
}

