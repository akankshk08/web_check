import { PageHeader } from "@/components/shared/page";
import { PathTabs } from "@/components/shared/path-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { getAccessibleProject } from "@/server/services/access";

export default async function PortalProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const project = await orNotFound(getAccessibleProject(getDb(), ctx, id, { allowClient: true }));
  const base = `/portal/projects/${project.id}`;
  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ href: "/portal/projects", label: "Projects" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            {project.dueDate && <span>Target {formatDate(project.dueDate)}</span>}
          </span>
        }
      />
      <div className="mb-6">
        <PathTabs
          tabs={[
            { href: base, label: "Overview", exact: true },
            { href: `${base}/milestones`, label: "Milestones" },
            { href: `${base}/deliverables`, label: "Deliverables" },
            { href: `${base}/files`, label: "Shared files" },
          ]}
        />
      </div>
      {children}
    </>
  );
}

export const metadata = { title: "Project" };
