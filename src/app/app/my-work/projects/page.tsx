import type { Metadata } from "next";
import { ProjectTable } from "@/components/projects/project-list";
import { PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireStaffPage } from "@/server/auth/session";
import { pageNumber, sp } from "@/server/page";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "My projects" };

export default async function MyProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const page = pageNumber(sp((await searchParams).page));
  const data = await listProjects(getDb(), ctx, { onlyMine: true, page, sort: "due" });
  return (
    <>
      <PageHeader title="My projects" description="Projects you’re a member of." />
      <Card>
        <ProjectTable rows={data.rows} emptyTitle="You’re not assigned to any projects yet" emptyDescription="An admin will add you to projects you work on." />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/app/my-work/projects" params={{}} />
      </Card>
    </>
  );
}
