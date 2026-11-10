import Link from "next/link";
import { DetailList } from "@/components/shared/page";
import { Discussion } from "@/components/projects/discussion";
import { PriorityBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { humanize } from "@/lib/utils";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listProjectComments } from "@/server/services/comments";
import { getOrganization } from "@/server/services/organizations";
import { getProjectDetail } from "@/server/services/projects";
import { projectHours } from "@/server/services/timesheets";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const db = getDb();
  const { project, client, members, taskStats } = await orNotFound(getProjectDetail(db, ctx, id));
  const [comments, hours, org] = await Promise.all([listProjectComments(db, ctx, project.id), projectHours(db, project.id), getOrganization(db, ctx)]);
  const manager = isManager(ctx);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <span className="text-sm font-semibold tabular-nums">{project.progress}%</span>
          </CardHeader>
          <CardContent>
            <Progress value={project.progress} tone={project.progress === 100 ? "success" : "primary"} />
            <div className="mt-4 grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
              <div>
                <p className="text-muted">Tasks</p>
                <p className="font-semibold tabular-nums">{taskStats.total}</p>
              </div>
              <div>
                <p className="text-muted">Completed</p>
                <p className="font-semibold tabular-nums">{taskStats.completed}</p>
              </div>
              <div>
                <p className="text-muted">Overdue</p>
                <p className={`font-semibold tabular-nums ${taskStats.overdue ? "text-danger" : ""}`}>{taskStats.overdue}</p>
              </div>
              <div>
                <p className="text-muted">Hours logged</p>
                <p className="font-semibold tabular-nums">
                  {hours} <span className="font-normal text-muted">/ {Number(taskStats.estimate)} est.</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{project.description || <span className="text-muted">No description.</span>}</p>
            {manager && project.internalNotes && (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft/60 p-3">
                <p className="text-xs font-medium text-[#8a5a08]">Internal notes</p>
                <p className="mt-1 text-[13px] whitespace-pre-wrap">{project.internalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Discussion</CardTitle>
              <p className="mt-0.5 text-[13px] text-muted">Internal messages are never shown to the client.</p>
            </div>
          </CardHeader>
          <CardContent>
            <Discussion projectId={project.id} comments={comments} isClient={false} />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                {
                  label: "Client",
                  value: manager ? (
                    <Link href={`/app/clients/${client.id}`} className="text-primary hover:underline">
                      {client.companyName ?? client.name}
                    </Link>
                  ) : (
                    (client.companyName ?? client.name)
                  ),
                },
                { label: "Type", value: humanize(project.type) },
                { label: "Priority", value: <PriorityBadge priority={project.priority} /> },
                { label: "Start", value: formatDate(project.startDate) },
                { label: "Due", value: formatDate(project.dueDate) },
                ...(manager ? [{ label: "Budget", value: project.budget ? formatMoney(project.budget, org.currency) : "—" }] : []),
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length ? (
              <ul className="flex flex-col gap-3">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3">
                    <Avatar name={m.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{m.fullName}</p>
                      <p className="truncate text-xs text-muted">{m.jobTitle ?? m.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No one is assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
