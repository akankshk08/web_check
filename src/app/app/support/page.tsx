import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { FilterBar } from "@/components/shared/filters";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { RespondToTicket } from "@/components/support/ticket-respond";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { ticketStatusEnum } from "@/db/schema/enums";
import { timeAgo } from "@/lib/dates";
import { requireManagerPage } from "@/server/auth/session";
import { pickEnum, sp } from "@/server/page";
import { listTickets } from "@/server/services/support";

export const metadata: Metadata = { title: "Support tickets" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireManagerPage();
  const status = pickEnum(sp((await searchParams).status), ticketStatusEnum.enumValues);
  const tickets = await listTickets(getDb(), ctx, { status });
  return (
    <>
      <PageHeader title="Support tickets" description="Requests raised by clients from their portal." />
      <Card>
        <div className="border-b border-border p-3">
          <FilterBar searchPlaceholder={null} filters={[{ name: "status", label: "All statuses", options: [...ticketStatusEnum.enumValues] }]} />
        </div>
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No tickets" description="When clients raise support tickets, they appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    <Link href={`/app/clients/${t.clientId}`} className="hover:underline">
                      {t.clientName ?? "Client"}
                    </Link>
                    {t.projectName ? ` · ${t.projectName}` : ""} · {t.createdByName} · {timeAgo(t.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                  <RespondToTicket ticket={t} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
