import Link from "next/link";
import { CheckSquare, KanbanSquare, List } from "lucide-react";
import { FilterBar } from "@/components/shared/filters";
import { EmptyState } from "@/components/shared/page";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskBoard, TaskList } from "@/components/tasks/task-board";
import { TaskDrawerLoader } from "@/components/tasks/task-drawer-loader";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { priorityEnum, taskStatusEnum } from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound, pickEnum, sp } from "@/server/page";
import { listMilestoneOptions } from "@/server/services/milestones";
import { getProjectDetail } from "@/server/services/projects";
import { listProjectTasks } from "@/server/services/tasks";
import { listStaffOptions } from "@/server/services/team";

export default async function ProjectTasksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const manager = isManager(ctx);
  const { project, members } = await orNotFound(getProjectDetail(db, ctx, id));
  const view = sp(query.view) === "list" ? "list" : "board";
  const filters = {
    q: sp(query.q),
    status: pickEnum(sp(query.status), taskStatusEnum.enumValues),
    priority: pickEnum(sp(query.priority), priorityEnum.enumValues),
    assigneeId: members.some((m) => m.userId === sp(query.assigneeId)) ? sp(query.assigneeId) : undefined,
  };
  const [tasks, milestones, staff] = await Promise.all([
    listProjectTasks(db, ctx, project.id, filters),
    listMilestoneOptions(db, ctx, project.id),
    manager ? listStaffOptions(db, ctx) : Promise.resolve([]),
  ]);
  const base = `/app/projects/${project.id}/tasks`;
  const toggle = (v: "board" | "list") => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(filters)) if (val) p.set(k, val);
    if (v === "list") p.set("view", "list");
    return p.size ? `${base}?${p}` : base;
  };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          searchPlaceholder="Search tasks"
          filters={[
            { name: "status", label: "All statuses", options: [...taskStatusEnum.enumValues] },
            { name: "priority", label: "All priorities", options: [...priorityEnum.enumValues] },
            { name: "assigneeId", label: "Everyone", options: members.map((m) => ({ value: m.userId, label: m.fullName })) },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="View">
            {(["board", "list"] as const).map((v) => (
              <Link
                key={v}
                href={toggle(v)}
                aria-current={view === v ? "page" : undefined}
                className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px]", view === v ? "bg-subtle font-medium" : "text-muted hover:text-foreground")}
              >
                {v === "board" ? <KanbanSquare className="size-4" /> : <List className="size-4" />}
                {v === "board" ? "Board" : "List"}
              </Link>
            ))}
          </div>
          {manager && !project.archivedAt && <NewTaskButton projectId={project.id} options={{ milestones, staff }} />}
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title={filtered ? "No tasks match your filters" : "No tasks yet"}
            description={filtered ? "Try clearing a filter." : manager ? "Break the project into tasks and assign them to your team." : "Tasks assigned in this project will show up here."}
          />
        </Card>
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} currentUserId={ctx.userId} isManager={manager} />
      ) : (
        <Card>
          <TaskList tasks={tasks} currentUserId={ctx.userId} isManager={manager} />
        </Card>
      )}
      <TaskDrawerLoader ctx={ctx} taskId={sp(query.task)} />
    </>
  );
}
