import { Flag } from "lucide-react";
import { FileList } from "@/components/files/file-list";
import { MilestoneHistory } from "@/components/milestones/milestone-history";
import { ReviewActions } from "@/components/portal/review-actions";
import { EmptyState } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listMilestones } from "@/server/services/milestones";
import { canApproveForClient } from "@/server/services/portal";

export default async function PortalMilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const db = getDb();
  const { project, milestones } = await orNotFound(listMilestones(db, ctx, id));
  const canApprove = await canApproveForClient(db, ctx, project.clientId);

  if (milestones.length === 0) {
    return (
      <Card>
        <EmptyState icon={Flag} title="No milestones yet" description="Your agency will add milestones as the project is planned." />
      </Card>
    );
  }
  return (
    <ol className="flex flex-col gap-4">
      {milestones.map((m, i) => (
        <li key={m.id}>
          <Card className={m.status === "SUBMITTED" ? "border-info/40" : undefined}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{m.title}</h2>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}
                    {m.approvedAt ? ` · Approved ${formatDate(m.approvedAt)}` : ""}
                  </p>
                  {m.description && <p className="mt-2 text-[13px] whitespace-pre-wrap text-muted">{m.description}</p>}
                </div>
              </div>
              {m.status === "SUBMITTED" && (
                <div className="ml-10 rounded-md bg-info-soft p-3">
                  <p className="mb-2 text-[13px] text-info">This milestone is ready for your review.{canApprove ? "" : " Only approvers on your account can approve it."}</p>
                  <ReviewActions milestoneId={m.id} canDecide={canApprove} />
                </div>
              )}
              <div className="grid gap-4 pl-10 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted">Deliverables</h3>
                  <FileList files={m.deliverables} showVisibility={false} empty="No deliverables attached." />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-medium text-muted">Review history</h3>
                  {m.history.length ? <MilestoneHistory history={m.history} /> : <p className="text-[13px] text-muted">Not submitted yet.</p>}
                  {m.status !== "SUBMITTED" && m.history.length > 0 && (
                    <div className="mt-3">
                      <ReviewActions milestoneId={m.id} canDecide={false} />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}
