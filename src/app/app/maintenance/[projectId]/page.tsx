import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { DeleteMaintenanceButton, DeliveryForm, MaintenanceRecordDialog } from "@/components/maintenance/maintenance-forms";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { requireManagerPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { getDelivery } from "@/server/services/maintenance";

export const metadata: Metadata = { title: "Delivery & maintenance" };

export default async function ProjectMaintenancePage({ params }: { params: Promise<{ projectId: string }> }) {
  const ctx = await requireManagerPage();
  const { projectId } = await params;
  const { project, delivery, records } = await orNotFound(getDelivery(getDb(), ctx, projectId));

  return (
    <>
      <PageHeader
        title={project.name}
        description="Delivery details and maintenance history"
        breadcrumbs={[
          { href: "/app/maintenance", label: "Maintenance" },
          { href: `/app/projects/${project.id}`, label: "Project" },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryForm
              initial={{
                projectId: project.id,
                productionUrl: delivery?.productionUrl ?? "",
                hostingProvider: delivery?.hostingProvider ?? "",
                domainProvider: delivery?.domainProvider ?? "",
                domainExpiry: delivery?.domainExpiry ?? "",
                sslExpiry: delivery?.sslExpiry ?? "",
                deployedOn: delivery?.deployedOn ?? "",
                handoverNotes: delivery?.handoverNotes ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card className="self-start xl:col-span-3">
          <CardHeader>
            <CardTitle>Maintenance history</CardTitle>
            <MaintenanceRecordDialog projectId={project.id} />
          </CardHeader>
          {records.length === 0 ? (
            <EmptyState icon={Wrench} title="No maintenance recorded" description="Log updates, backups, security patches and fixes here." />
          ) : (
            <ul className="divide-y divide-border">
              {records.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{r.title}</p>
                      <Badge>{humanize(r.type)}</Badge>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.completedOn ? `Completed ${formatDate(r.completedOn)}` : r.scheduledFor ? `Scheduled ${formatDate(r.scheduledFor)}` : "No date"}
                      {r.hours ? ` · ${Number(r.hours)}h` : ""}
                      {r.performedByName ? ` · ${r.performedByName}` : ""}
                    </p>
                    {r.description && <p className="mt-1 text-[13px] whitespace-pre-wrap text-muted">{r.description}</p>}
                  </div>
                  <MaintenanceRecordDialog
                    projectId={project.id}
                    record={{
                      id: r.id,
                      projectId: project.id,
                      type: r.type,
                      title: r.title,
                      description: r.description ?? "",
                      status: r.status,
                      scheduledFor: r.scheduledFor ?? "",
                      completedOn: r.completedOn ?? "",
                      hours: r.hours ?? "",
                    }}
                  />
                  <DeleteMaintenanceButton id={r.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
