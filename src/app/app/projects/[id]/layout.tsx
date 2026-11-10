import { ProjectHeaderActions } from "@/components/projects/project-header-actions";
import { PageHeader } from "@/components/shared/page";
import { PathTabs } from "@/components/shared/path-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listClientOptions } from "@/server/services/clients";
import { getProjectDetail } from "@/server/services/projects";
import { listStaffOptions } from "@/server/services/team";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const db = getDb();
  const { project, client, members } = await orNotFound(getProjectDetail(db, ctx, id));
  const manager = isManager(ctx);
  const [clients, staff] = manager ? await Promise.all([listClientOptions(db, ctx), listStaffOptions(db, ctx)]) : [[], []];
  const base = `/app/projects/${project.id}`;

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ href: manager ? "/app/projects" : "/app/my-work/projects", label: "Projects" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <span>{client.companyName ?? client.name}</span>
            {project.dueDate && <span>· Due {formatDate(project.dueDate)}</span>}
            {project.archivedAt && <span className="font-medium text-danger">· Archived</span>}
          </span>
        }
        actions={
          manager ? (
            <ProjectHeaderActions
              archived={!!project.archivedAt}
              clients={clients.some((c) => c.id === client.id) ? clients : [...clients, { id: client.id, name: client.name, companyName: client.companyName }]}
              staff={staff}
              project={{
                id: project.id,
                name: project.name,
                description: project.description ?? "",
                internalNotes: project.internalNotes ?? "",
                clientId: project.clientId,
                type: project.type,
                status: project.status,
                priority: project.priority,
                budget: project.budget ?? "",
                startDate: project.startDate ?? "",
                dueDate: project.dueDate ?? "",
                memberIds: members.map((m) => m.userId),
              }}
            />
          ) : undefined
        }
      />
      <div className="mb-6">
        <PathTabs
          tabs={[
            { href: base, label: "Overview", exact: true },
            { href: `${base}/tasks`, label: "Tasks" },
            { href: `${base}/milestones`, label: "Milestones" },
            { href: `${base}/files`, label: "Files" },
            { href: `${base}/activity`, label: "Activity" },
            ...(manager ? [{ href: `/app/maintenance/${project.id}`, label: "Delivery & maintenance" }] : []),
          ]}
        />
      </div>
      {children}
    </>
  );
}

export const metadata = { title: "Project" };
