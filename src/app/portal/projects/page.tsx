import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { requireClientPage } from "@/server/auth/session";
import { listPortalProjects } from "@/server/services/portal";

export const metadata: Metadata = { title: "Projects" };

export default async function PortalProjectsPage() {
  const ctx = await requireClientPage();
  const projects = await listPortalProjects(getDb(), ctx);
  return (
    <>
      <PageHeader title="Projects" />
      {projects.length === 0 ? (
        <Card>
          <EmptyState icon={FolderKanban} title="No projects yet" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/portal/projects/${p.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-[#d5dae3]">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{p.name}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 text-xs text-muted">{humanize(p.type)}</p>
                {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted">{p.description}</p>}
                <div className="mt-4 flex items-center gap-2">
                  <Progress value={p.progress} />
                  <span className="text-xs text-muted tabular-nums">{p.progress}%</span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {formatDate(p.startDate)} → {formatDate(p.dueDate)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
