import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { TicketForm } from "@/components/portal/ticket-form";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { timeAgo } from "@/lib/dates";
import { requireClientPage } from "@/server/auth/session";
import { listPortalProjects } from "@/server/services/portal";
import { listTickets } from "@/server/services/support";

export const metadata: Metadata = { title: "Support" };

export default async function PortalSupportPage() {
  const ctx = await requireClientPage();
  const db = getDb();
  const [projects, tickets] = await Promise.all([listPortalProjects(db, ctx), listTickets(db, ctx)]);
  return (
    <>
      <PageHeader title="Support" description="Report a problem or ask for help with your website or project." />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="self-start xl:col-span-2">
          <CardHeader>
            <CardTitle>New ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketForm projects={projects} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          {tickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No tickets yet" />
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-sm font-medium">{t.subject}</p>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xs text-muted">
                    {t.projectName ?? "General"} · opened {timeAgo(t.createdAt)} by {t.createdByName}
                  </p>
                  <p className="mt-2 text-[13px] whitespace-pre-wrap text-muted">{t.description}</p>
                  {t.staffResponse && (
                    <div className="mt-2 rounded-md bg-primary-soft p-3 text-[13px]">
                      <p className="text-xs font-medium text-primary">Response from the team</p>
                      <p className="mt-1 whitespace-pre-wrap">{t.staffResponse}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
