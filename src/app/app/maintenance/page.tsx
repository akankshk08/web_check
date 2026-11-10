import type { Metadata } from "next";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { daysUntil, formatDate } from "@/lib/dates";
import { safeExternalUrl } from "@/lib/utils";
import { requireManagerPage } from "@/server/auth/session";
import { listDeliveries } from "@/server/services/maintenance";

export const metadata: Metadata = { title: "Maintenance" };

function ExpiryCell({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      {formatDate(date)}
      {d < 0 ? <Badge tone="danger">Expired</Badge> : d <= 30 ? <Badge tone="warning">{d}d left</Badge> : null}
    </span>
  );
}

export default async function MaintenancePage() {
  const ctx = await requireManagerPage();
  const rows = await listDeliveries(getDb(), ctx);
  return (
    <>
      <PageHeader
        title="Delivery & maintenance"
        description="Production details and maintenance history for sites you’ve delivered. Dates are entered by your team — AgencyOS does not monitor domains or certificates."
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Globe2} title="No delivered projects yet" description="Completed projects (and maintenance-type projects) appear here so you can record delivery details." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Production URL</TH>
                <TH>Hosting</TH>
                <TH>Domain expiry</TH>
                <TH>SSL expiry</TH>
                <TH className="text-right">Open tasks</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const url = safeExternalUrl(r.productionUrl);
                return (
                  <TR key={r.projectId}>
                    <TD>
                      <Link href={`/app/maintenance/${r.projectId}`} className="font-medium hover:underline">
                        {r.projectName}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {r.clientName} <StatusBadge status={r.projectStatus} />
                      </span>
                    </TD>
                    <TD className="max-w-[220px] truncate">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {r.productionUrl}
                        </a>
                      ) : (
                        <span className="text-muted">Not recorded</span>
                      )}
                    </TD>
                    <TD className="text-muted">{r.hostingProvider ?? "—"}</TD>
                    <TD>
                      <ExpiryCell date={r.domainExpiry} />
                    </TD>
                    <TD>
                      <ExpiryCell date={r.sslExpiry} />
                    </TD>
                    <TD className="text-right tabular-nums">{r.openMaintenance}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
