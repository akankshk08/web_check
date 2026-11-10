import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, Clock, FolderKanban } from "lucide-react";
import { DetailList, EmptyState, PageHeader } from "@/components/shared/page";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, isOverdue } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { getMemberProfile } from "@/server/services/team";

export const metadata: Metadata = { title: "Team member" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const { member, projects, tasks, timeEntries, restricted } = await orNotFound(getMemberProfile(getDb(), ctx, id));
  const hours = timeEntries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <>
      <PageHeader title={member.fullName} breadcrumbs={[{ href: "/app/team", label: "Team" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="self-start">
          <CardContent className="flex flex-col items-center py-6 text-center">
            <Avatar name={member.fullName} size={64} />
            <p className="mt-3 font-semibold">{member.fullName}</p>
            <p className="text-[13px] text-muted">{member.jobTitle ?? "—"}</p>
            <Badge className="mt-2" tone="primary">
              {humanize(member.role)}
            </Badge>
          </CardContent>
          <CardContent className="border-t border-border">
            <DetailList
              items={[
                { label: "Email", value: member.email },
                { label: "Phone", value: member.phone },
                { label: "Joined", value: formatDate(member.joinedAt) },
                { label: "Weekly capacity", value: `${member.weeklyCapacityHours} hours` },
              ]}
            />
          </CardContent>
        </Card>

        {restricted ? (
          <Card className="xl:col-span-2">
            <EmptyState icon={FolderKanban} title="Workload is private" description="Only owners, admins and the member themselves can see assigned work." />
          </Card>
        ) : (
          <div className="flex flex-col gap-6 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Assigned projects ({projects.length})</CardTitle>
              </CardHeader>
              {projects.length ? (
                <ul className="divide-y divide-border">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fafbfc]">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                        <StatusBadge status={p.status} />
                        <div className="hidden w-28 sm:block">
                          <Progress value={p.progress} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={FolderKanban} title="Not assigned to any projects" />
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Open tasks ({tasks.length})</CardTitle>
              </CardHeader>
              {tasks.length ? (
                <ul className="divide-y divide-border">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <Link href={`/app/projects/${t.projectId}/tasks?task=${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafbfc]">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className={`text-xs ${isOverdue(t.dueDate, false) ? "text-danger" : "text-muted"}`}>
                            {t.projectName} · {t.dueDate ? `due ${formatDate(t.dueDate)}` : "no due date"}
                          </p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CheckSquare} title="No open tasks" />
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent time entries</CardTitle>
                <span className="text-[13px] text-muted">{hours.toFixed(2)}h shown</span>
              </CardHeader>
              {timeEntries.length ? (
                <ul className="divide-y divide-border">
                  {timeEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-4 px-5 py-2.5 text-[13px]">
                      <span className="w-24 text-muted">{formatDate(e.workDate)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {e.projectName}
                        {e.description ? ` — ${e.description}` : ""}
                      </span>
                      <span className="tabular-nums">{Number(e.hours)}h</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Clock} title="No time recorded yet" />
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
