"use client";
import { CalendarDays, ListTree } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { Avatar } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { TaskStatus } from "@/db/schema/enums";
import { taskStatusEnum } from "@/db/schema/enums";
import { formatDate, isOverdue } from "@/lib/dates";
import { cn, humanize } from "@/lib/utils";
import { updateTaskStatusAction } from "@/server/actions/tasks";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  position: number;
  assigneeId: string | null;
  assigneeName: string | null;
  subtaskCount: number;
  parentTaskId: string | null;
  projectName?: string;
  projectId: string;
};

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "COMPLETED"];

function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };
}

/** Optimistic status change backed by the server action (which enforces permissions). */
function useStatusChange(initial: BoardTask[]) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  useEffect(() => setTasks(initial), [initial]);
  const change = async (task: BoardTask, status: TaskStatus) => {
    if (task.status === status) return;
    const position = Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.position)) + 1;
    const previous = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status, position } : t)));
    const res = await updateTaskStatusAction({ id: task.id, status, position });
    if (!res.ok) {
      setTasks(previous);
      toast.error(res.error);
      return;
    }
    router.refresh();
  };
  return { tasks, change };
}

function canMove(task: BoardTask, currentUserId: string, isManager: boolean) {
  return isManager || task.assigneeId === currentUserId;
}

export function TaskBoard({ tasks: initial, currentUserId, isManager }: { tasks: BoardTask[]; currentUserId: string; isManager: boolean }) {
  const { tasks, change } = useStatusChange(initial);
  const openTask = useOpenTask();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const topLevel = tasks.filter((t) => !t.parentTaskId);

  return (
    <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((status) => {
        const items = topLevel.filter((t) => t.status === status).sort((a, b) => a.position - b.position);
        return (
          <section
            key={status}
            aria-label={humanize(status)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const task = tasks.find((t) => t.id === dragId);
              if (task) void change(task, status);
              setDragId(null);
            }}
            className={cn("flex min-h-[200px] flex-col rounded-lg bg-[#f1f4f8] p-2 transition-colors", over === status && "bg-primary-soft ring-2 ring-primary/30")}
          >
            <header className="mb-2 flex items-center justify-between px-1.5 py-1">
              <StatusBadge status={status} />
              <span className="text-xs text-muted tabular-nums">{items.length}</span>
            </header>
            <ul className="flex flex-col gap-2">
              {items.map((t) => {
                const movable = canMove(t, currentUserId, isManager);
                return (
                  <li
                    key={t.id}
                    draggable={movable}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn("rounded-md border border-border bg-surface shadow-card transition-shadow hover:shadow-pop", movable && "cursor-grab active:cursor-grabbing", dragId === t.id && "opacity-50")}
                  >
                    <button type="button" onClick={() => openTask(t.id)} className="block w-full p-3 text-left">
                      <p className="text-[13px] leading-snug font-medium">{t.title}</p>
                      {t.projectName && <p className="mt-0.5 truncate text-xs text-muted">{t.projectName}</p>}
                      <div className="mt-2.5 flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        {t.subtaskCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <ListTree className="size-3" aria-hidden /> {t.subtaskCount}
                          </span>
                        )}
                        {t.dueDate && (
                          <span className={cn("inline-flex items-center gap-1 text-xs", isOverdue(t.dueDate, t.status === "COMPLETED") ? "text-danger" : "text-muted")}>
                            <CalendarDays className="size-3" aria-hidden /> {formatDate(t.dueDate, "MMM d")}
                          </span>
                        )}
                        <span className="ml-auto">{t.assigneeName ? <Avatar name={t.assigneeName} size={22} /> : null}</span>
                      </div>
                    </button>
                    {/* Keyboard / non-drag alternative for moving between columns */}
                    {movable && (
                      <div className="border-t border-border px-3 py-1.5">
                        <label className="sr-only" htmlFor={`move-${t.id}`}>
                          Move {t.title}
                        </label>
                        <select
                          id={`move-${t.id}`}
                          value={t.status}
                          onChange={(e) => change(t, e.target.value as TaskStatus)}
                          className="w-full bg-transparent text-xs text-muted focus:outline-none"
                        >
                          {taskStatusEnum.enumValues.map((s) => (
                            <option key={s} value={s}>
                              Move to: {humanize(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function TaskList({ tasks: initial, currentUserId, isManager }: { tasks: BoardTask[]; currentUserId: string; isManager: boolean }) {
  const { tasks, change } = useStatusChange(initial);
  const openTask = useOpenTask();
  return (
    <Table>
      <THead>
        <tr>
          <TH>Task</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
          <TH>Assignee</TH>
          <TH>Due</TH>
        </tr>
      </THead>
      <TBody>
        {tasks.map((t) => (
          <TR key={t.id}>
            <TD className="max-w-[340px]">
              <button type="button" onClick={() => openTask(t.id)} className={cn("block truncate text-left font-medium hover:underline", t.parentTaskId && "pl-4 text-muted")}>
                {t.parentTaskId ? "↳ " : ""}
                {t.title}
              </button>
              {t.projectName && <span className="block truncate text-xs text-muted">{t.projectName}</span>}
            </TD>
            <TD>
              {canMove(t, currentUserId, isManager) ? (
                <Select aria-label={`Status of ${t.title}`} value={t.status} onChange={(e) => change(t, e.target.value as TaskStatus)} className="h-8 w-40 text-xs">
                  {taskStatusEnum.enumValues.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              ) : (
                <StatusBadge status={t.status} />
              )}
            </TD>
            <TD>
              <PriorityBadge priority={t.priority} />
            </TD>
            <TD className="text-muted">{t.assigneeName ?? "Unassigned"}</TD>
            <TD className={isOverdue(t.dueDate, t.status === "COMPLETED" || t.status === "CANCELLED") ? "text-danger" : "text-muted"}>{formatDate(t.dueDate)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
