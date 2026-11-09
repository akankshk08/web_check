import { ActivityFeed } from "@/components/projects/activity-feed";
import { Discussion } from "@/components/projects/discussion";
import { DetailList } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listProjectActivity } from "@/server/services/activity";
import { listProjectComments } from "@/server/services/comments";
import { listMilestones } from "@/server/services/milestones";

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const db = getDb();
  const { project, milestones } = await orNotFound(listMilestones(db, ctx, id));
  const [comments, activity] = await Promise.all([listProjectComments(db, ctx, project.id), listProjectActivity(db, ctx, project.id)]);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>About this project</CardTitle>
            <span className="text-sm font-semibold tabular-nums">{project.progress}%</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress value={project.progress} tone={project.progress === 100 ? "success" : "primary"} />
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{project.description || <span className="text-muted">No description.</span>}</p>
            <DetailList
              items={[
                { label: "Type", value: humanize(project.type) },
                { label: "Start", value: formatDate(project.startDate) },
                { label: "Target completion", value: formatDate(project.dueDate) },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <Discussion projectId={project.id} comments={comments} isClient />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length ? (
              <ol className="flex flex-col gap-3 border-l border-border pl-4">
                {milestones.map((m) => (
                  <li key={m.id} className="relative">
                    <span className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-surface ${m.status === "APPROVED" ? "bg-success" : m.status === "SUBMITTED" ? "bg-info" : "bg-[#cfd5df]"}`} aria-hidden />
                    <p className="text-[13px] font-medium">{m.title}</p>
                    <p className="flex items-center gap-2 text-xs text-muted">
                      {m.dueDate ? formatDate(m.dueDate) : "No date"} <StatusBadge status={m.status} />
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-muted">The timeline will appear once milestones are planned.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent updates</CardTitle>
          </CardHeader>
          <ActivityFeed rows={activity.rows.slice(0, 10)} />
        </Card>
      </div>
    </div>
  );
}
