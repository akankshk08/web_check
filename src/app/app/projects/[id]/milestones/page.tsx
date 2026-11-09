import { Flag } from "lucide-react";
import { FileList } from "@/components/files/file-list";
import { FileUploader } from "@/components/files/file-uploader";
import { DeleteMilestoneButton, EditMilestoneButton, NewMilestoneButton, SubmitForReviewButton } from "@/components/milestones/milestone-actions";
import { MilestoneHistory } from "@/components/milestones/milestone-history";
import { EmptyState } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, isOverdue } from "@/lib/dates";
import { serverEnv } from "@/lib/server-env";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { clientUserIds } from "@/server/services/clients";
import { listMilestones } from "@/server/services/milestones";

export default async function ProjectMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const db = getDb();
  const { project, milestones } = await orNotFound(listMilestones(db, ctx, id));
  const manager = isManager(ctx);
  const hasClientUsers = manager ? (await clientUserIds(db, ctx.orgId, project.clientId, { approversOnly: true })).length > 0 : false;
  const bucket = serverEnv().SUPABASE_STORAGE_BUCKET;

  return (
    <>
      {manager && !project.archivedAt && (
        <div className="mb-4 flex justify-end">
          <NewMilestoneButton projectId={project.id} />
        </div>
      )}
      {milestones.length === 0 ? (
        <Card>
          <EmptyState icon={Flag} title="No milestones yet" description="Split the project into milestones like Design, Development and Launch. Clients approve each one." />
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {milestones.map((m, i) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{m.title}</h2>
                        <StatusBadge status={m.status} />
                      </div>
                      <p className={`mt-0.5 text-xs ${isOverdue(m.dueDate, m.status === "APPROVED") ? "text-danger" : "text-muted"}`}>
                        {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}
                        {m.approvedAt ? ` · Approved ${formatDate(m.approvedAt)}` : ""}
                      </p>
                      {m.description && <p className="mt-2 text-[13px] whitespace-pre-wrap text-muted">{m.description}</p>}
                    </div>
                    {manager && (
                      <div className="flex items-center gap-1">
                        {m.status !== "APPROVED" && m.status !== "SUBMITTED" && <SubmitForReviewButton milestoneId={m.id} hasClientUsers={hasClientUsers} />}
                        <EditMilestoneButton milestone={m} />
                        {m.status !== "APPROVED" && <DeleteMilestoneButton id={m.id} title={m.title} />}
                      </div>
                    )}
                  </div>
                  {m.taskTotal > 0 && (
                    <div className="flex items-center gap-3 pl-10">
                      <Progress value={(m.taskDone / m.taskTotal) * 100} className="max-w-xs" />
                      <span className="text-xs text-muted">
                        {m.taskDone}/{m.taskTotal} tasks done
                      </span>
                    </div>
                  )}
                  <div className="grid gap-4 pl-10 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-xs font-medium text-muted">Deliverables</h3>
                      <FileList files={m.deliverables.map((d) => ({ ...d, canDelete: manager }))} empty="No deliverables attached." />
                      {manager && m.status !== "APPROVED" && (
                        <div className="mt-3">
                          <FileUploader projectId={project.id} milestoneId={m.id} canShare deliverable bucket={bucket} label="Attach deliverable" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 text-xs font-medium text-muted">Review history</h3>
                      {m.history.length ? <MilestoneHistory history={m.history} /> : <p className="text-[13px] text-muted">Not submitted yet.</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
