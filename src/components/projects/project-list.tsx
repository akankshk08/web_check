import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/shared/page";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { AvatarStack, Progress } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, isOverdue } from "@/lib/dates";
import type { listProjects } from "@/server/services/projects";

type Row = Awaited<ReturnType<typeof listProjects>>["rows"][number];

export function ProjectTable({ rows, emptyTitle, emptyDescription, emptyAction }: { rows: Row[]; emptyTitle: string; emptyDescription?: string; emptyAction?: React.ReactNode }) {
  if (rows.length === 0) return <EmptyState icon={FolderKanban} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Project</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
          <TH className="w-40">Progress</TH>
          <TH>Due</TH>
          <TH>Team</TH>
        </tr>
      </THead>
      <TBody>
        {rows.map((p) => {
          const overdue = isOverdue(p.dueDate, p.status === "COMPLETED" || p.status === "CANCELLED");
          return (
            <TR key={p.id}>
              <TD className="max-w-[280px]">
                <Link href={`/app/projects/${p.id}`} className="block truncate font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="block truncate text-xs text-muted">{p.clientName}</span>
              </TD>
              <TD>
                <StatusBadge status={p.status} />
              </TD>
              <TD>
                <PriorityBadge priority={p.priority} />
              </TD>
              <TD>
                <div className="flex items-center gap-2">
                  <Progress value={p.progress} />
                  <span className="w-9 text-right text-xs text-muted tabular-nums">{p.progress}%</span>
                </div>
              </TD>
              <TD className={overdue ? "text-danger" : "text-muted"}>{formatDate(p.dueDate)}</TD>
              <TD>
                <AvatarStack names={p.members.map((m) => m.fullName)} />
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
