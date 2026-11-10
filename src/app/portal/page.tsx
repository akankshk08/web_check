import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, FileText, Flag, FolderKanban, Receipt } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, timeAgo } from "@/lib/dates";
import { formatMoney, subtractMoney } from "@/lib/money";
import { requireClientPage } from "@/server/auth/session";
import { getPortalDashboard } from "@/server/services/portal";

export const metadata: Metadata = { title: "Client portal" };

export default async function PortalHome() {
  const ctx = await requireClientPage();
  const d = await getPortalDashboard(getDb(), ctx);
  const active = d.projects.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED");

  return (
    <>
      <PageHeader title={`Welcome, ${ctx.fullName.split(" ")[0]}`} description={`Your projects with ${ctx.orgName}.`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active projects" value={active.length} icon={FolderKanban} href="/portal/projects" />
        <StatCard label="Awaiting your approval" value={d.pendingApprovals.length} icon={FileCheck2} tone={d.pendingApprovals.length ? "warning" : "neutral"} />
        <StatCard label="Upcoming milestones" value={d.upcomingMilestones.length} icon={Flag} />
        <StatCard label="Outstanding invoices" value={d.outstandingInvoices.length} icon={Receipt} tone={d.outstandingInvoices.some((i) => i.status === "OVERDUE") ? "danger" : "neutral"} href="/portal/invoices" />
      </div>

      {d.pendingApprovals.length > 0 && (
        <Card className="mt-6 border-warning/40">
          <CardHeader>
            <CardTitle>Waiting for your review</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border">
            {d.pendingApprovals.map((m) => (
              <li key={m.id}>
                <Link href={`/portal/projects/${m.projectId}/milestones`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafbfc]">
                  <FileCheck2 className="size-4 text-[#a86f0c]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{m.title}</span>
                    <span className="block text-xs text-muted">
                      {m.projectName} · submitted {m.submittedAt ? timeAgo(m.submittedAt) : ""}
                    </span>
                  </span>
                  <span className="text-[13px] font-medium text-primary">Review</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Project progress</CardTitle>
          </CardHeader>
          {d.projects.length ? (
            <ul className="divide-y divide-border">
              {d.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/portal/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-[#fafbfc] sm:grid-cols-[1fr_110px_160px]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{p.dueDate ? `Target ${formatDate(p.dueDate)}` : "No target date"}</span>
                    </span>
                    <StatusBadge status={p.status} />
                    <span className="hidden items-center gap-2 sm:flex">
                      <Progress value={p.progress} />
                      <span className="w-9 text-right text-xs text-muted tabular-nums">{p.progress}%</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FolderKanban} title="No projects yet" description="Projects your agency shares with you will appear here." />
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {d.upcomingMilestones.length ? (
                <ul className="flex flex-col gap-3">
                  {d.upcomingMilestones.map((m) => (
                    <li key={m.id}>
                      <Link href={`/portal/projects/${m.projectId}/milestones`} className="text-[13px] font-medium hover:underline">
                        {m.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {m.projectName} · {m.dueDate ? formatDate(m.dueDate) : "no date"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">Nothing scheduled.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent deliverables</CardTitle>
            </CardHeader>
            <CardContent>
              {d.recentDeliverables.length ? (
                <ul className="flex flex-col gap-3">
                  {d.recentDeliverables.map((f) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <FileText className="size-4 text-muted" aria-hidden />
                      <a href={`/api/files/${f.id}/download`} className="min-w-0 flex-1 truncate text-[13px] hover:underline">
                        {f.fileName}
                      </a>
                      <span className="text-xs text-muted">{timeAgo(f.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No deliverables shared yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outstanding invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {d.outstandingInvoices.length ? (
                <ul className="flex flex-col gap-3">
                  {d.outstandingInvoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <Link href={`/portal/invoices?invoice=${i.id}`} className="flex-1 text-[13px] font-medium hover:underline">
                        {i.number}
                      </Link>
                      <StatusBadge status={i.status} />
                      <span className="text-[13px] tabular-nums">{formatMoney(subtractMoney(i.total, i.amountPaid), i.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">You’re all paid up.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
