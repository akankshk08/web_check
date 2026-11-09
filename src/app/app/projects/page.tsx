import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectTable } from "@/components/projects/project-list";
import { FilterBar } from "@/components/shared/filters";
import { PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { projectStatusEnum } from "@/db/schema/enums";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { pageNumber, pickEnum, sp } from "@/server/page";
import { listClientOptions } from "@/server/services/clients";
import { listProjects, PROJECT_SORTS } from "@/server/services/projects";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const params = await searchParams;
  const manager = isManager(ctx);
  const db = getDb();
  const q = sp(params.q) ?? "";
  const status = pickEnum(sp(params.status), projectStatusEnum.enumValues);
  const sort = pickEnum(sp(params.sort), PROJECT_SORTS) ?? "updated";
  const clientId = manager ? sp(params.clientId) : undefined;
  const archived = manager && sp(params.view) === "archived";
  const page = pageNumber(sp(params.page));
  const [data, clients] = await Promise.all([
    listProjects(db, ctx, { q, status, sort, page, archived, clientId: clientId && /^[0-9a-f-]{36}$/.test(clientId) ? clientId : undefined }),
    manager ? listClientOptions(db, ctx) : Promise.resolve([]),
  ]);
  const filtered = !!(q || status || clientId || archived);

  return (
    <>
      <PageHeader
        title="Projects"
        description={manager ? "All projects in your workspace." : "Projects you’re assigned to."}
        actions={
          manager ? (
            <Button asChild>
              <Link href="/app/projects/new">
                <Plus /> New project
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Card>
        <div className="border-b border-border p-3">
          <FilterBar
            searchPlaceholder="Search projects"
            filters={[
              { name: "status", label: "All statuses", options: [...projectStatusEnum.enumValues] },
              ...(manager ? [{ name: "clientId", label: "All clients", options: clients.map((c) => ({ value: c.id, label: c.companyName ?? c.name })) }] : []),
              {
                name: "sort",
                label: "Recently updated",
                options: [
                  { value: "due", label: "Due date" },
                  { value: "name", label: "Name" },
                  { value: "progress", label: "Progress" },
                ],
              },
              ...(manager ? [{ name: "view", label: "Active projects", options: [{ value: "archived", label: "Archived projects" }] }] : []),
            ]}
          />
        </div>
        <ProjectTable
          rows={data.rows}
          emptyTitle={filtered ? "No projects match your filters" : manager ? "No projects yet" : "You’re not assigned to any projects yet"}
          emptyDescription={filtered ? "Try a different search or filter." : manager ? "Create a project for one of your clients to get started." : undefined}
          emptyAction={
            !filtered && manager ? (
              <Button asChild size="sm">
                <Link href="/app/projects/new">Create project</Link>
              </Button>
            ) : undefined
          }
        />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/app/projects" params={{ q, status, sort, clientId, view: archived ? "archived" : undefined }} />
      </Card>
    </>
  );
}
