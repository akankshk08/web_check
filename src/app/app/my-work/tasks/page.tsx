import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, KanbanSquare, List } from "lucide-react";
import { FilterBar } from "@/components/shared/filters";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { TaskBoard, TaskList } from "@/components/tasks/task-board";
import { TaskDrawerLoader } from "@/components/tasks/task-drawer-loader";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { priorityEnum, taskStatusEnum } from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { pickEnum, sp } from "@/server/page";
import { listMyTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const query = await searchParams;
  const view = sp(query.view) === "board" ? "board" : "list";
  const filters = { q: sp(query.q), status: pickEnum(sp(query.status), taskStatusEnum.enumValues), priority: pickEnum(sp(query.priority), priorityEnum.enumValues) };
  const tasks = (await listMyTasks(getDb(), ctx, { ...filters, includeDone: view === "board" })).map((t) => ({ ...t, subtaskCount: 0 }));
  const href = (v: string) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(filters)) if (val) p.set(k, val);
    if (v === "board") p.set("view", "board");
    return `/app/my-work/tasks${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="My tasks" description="Tasks assigned to you across all projects." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          searchPlaceholder="Search my tasks"
          filters={[
            { name: "status", label: "Open tasks", options: [...taskStatusEnum.enumValues] },
            { name: "priority", label: "All priorities", options: [...priorityEnum.enumValues] },
          ]}
        />
        <div className="inline-flex self-start rounded-md border border-border bg-surface p-0.5" role="group" aria-label="View">
          {(["list", "board"] as const).map((v) => (
            <Link key={v} href={href(v)} aria-current={view === v ? "page" : undefined} className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px]", view === v ? "bg-subtle font-medium" : "text-muted")}>
              {v === "board" ? <KanbanSquare className="size-4" /> : <List className="size-4" />}
              {v === "board" ? "Board" : "List"}
            </Link>
          ))}
        </div>
      </div>
      {tasks.length === 0 ? (
        <Card>
          <EmptyState icon={CheckSquare} title="No tasks here" description="Tasks assigned to you will appear here." />
        </Card>
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} currentUserId={ctx.userId} isManager={isManager(ctx)} />
      ) : (
        <Card>
          <TaskList tasks={tasks} currentUserId={ctx.userId} isManager={isManager(ctx)} />
        </Card>
      )}
      <TaskDrawerLoader ctx={ctx} taskId={sp(query.task)} />
    </>
  );
}
