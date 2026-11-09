"use client";
import { LocalTime } from "@/components/shared/local-time";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FileList, type FileRow } from "@/components/files/file-list";
import { FileUploader } from "@/components/files/file-uploader";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { DetailList } from "@/components/shared/page";
import { fieldProps, useAction, useActionSubmit } from "@/components/shared/form";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { taskStatusEnum, type TaskStatus } from "@/db/schema/enums";
import { formatDate } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { taskCommentSchema } from "@/lib/validations/entities";
import { addTaskCommentAction, archiveTaskAction, updateTaskStatusAction } from "@/server/actions/tasks";
import type { getTaskDetail } from "@/server/services/tasks";
import { TaskForm, type TaskFormOptions } from "./task-form";
import { TimeEntryForm } from "./time-entry-form";

type Detail = Awaited<ReturnType<typeof getTaskDetail>>;

function CommentForm({ taskId }: { taskId: string }) {
  const form = useForm<z.infer<typeof taskCommentSchema>>({ resolver: zodResolver(taskCommentSchema), defaultValues: { taskId, body: "" } });
  const onSubmit = useActionSubmit(form, addTaskCommentAction, { onSuccess: () => form.reset({ taskId, body: "" }) });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor="body" className="sr-only">
        Comment
      </label>
      <Textarea rows={2} placeholder="Add a comment…" {...fieldProps(form, "body")} />
      <Button type="submit" size="sm" className="self-end" loading={form.formState.isSubmitting}>
        Comment
      </Button>
    </form>
  );
}

export function TaskDrawer({
  detail,
  files,
  options,
  currentUserId,
  isManager,
  bucket,
}: {
  detail: Detail;
  files: FileRow[];
  options: TaskFormOptions;
  currentUserId: string;
  isManager: boolean;
  bucket: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [mode, setMode] = useState<"view" | "edit" | "subtask">("view");
  const { pending, run } = useAction();
  const { task } = detail;
  const canUpdate = isManager || task.assigneeId === currentUserId;

  const close = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("task");
    router.push(sp.size ? `${pathname}?${sp.toString()}` : pathname, { scroll: false });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent title={mode === "edit" ? "Edit task" : mode === "subtask" ? `Add subtask to “${task.title}”` : task.title} size="lg">
        {mode === "edit" ? (
          <TaskForm
            projectId={task.projectId}
            options={options}
            onDone={() => setMode("view")}
            task={{
              id: task.id,
              title: task.title,
              description: task.description ?? "",
              milestoneId: task.milestoneId ?? "",
              assigneeId: task.assigneeId ?? "",
              priority: task.priority,
              status: task.status,
              startDate: task.startDate ?? "",
              dueDate: task.dueDate ?? "",
              estimatedHours: task.estimatedHours ?? "",
            }}
          />
        ) : mode === "subtask" ? (
          <TaskForm projectId={task.projectId} parentTaskId={task.id} options={options} onDone={() => setMode("view")} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              {canUpdate ? (
                <Select
                  aria-label="Status"
                  className="h-8 w-44 text-xs"
                  value={task.status}
                  disabled={pending}
                  onChange={(e) => run(() => updateTaskStatusAction({ id: task.id, status: e.target.value as TaskStatus }), { success: "Status updated." })}
                >
                  {taskStatusEnum.enumValues.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              ) : (
                <StatusBadge status={task.status} />
              )}
              <PriorityBadge priority={task.priority} />
              {isManager && (
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>
                    <Pencil /> Edit
                  </Button>
                  <ConfirmButton
                    size="sm"
                    variant="ghost"
                    action={() => archiveTaskAction({ id: task.id })}
                    title="Delete task?"
                    description="The task and its subtasks will be removed from the board. Comments and logged time are kept for reporting."
                    confirmLabel="Delete task"
                    success="Task deleted."
                  >
                    <Trash2 /> Delete
                  </ConfirmButton>
                </div>
              )}
            </div>

            {task.description && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{task.description}</p>}

            <DetailList
              items={[
                { label: "Assignee", value: detail.assignee?.fullName ?? "Unassigned" },
                { label: "Project", value: detail.project.name },
                { label: "Start", value: formatDate(task.startDate) },
                { label: "Due", value: formatDate(task.dueDate) },
                { label: "Estimate", value: task.estimatedHours ? `${Number(task.estimatedHours)} h` : "—" },
                { label: "Completed", value: task.completedAt ? formatDate(task.completedAt) : "—" },
              ]}
            />

            {!task.parentTaskId && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Subtasks ({detail.subtasks.length})</h3>
                  {isManager && (
                    <Button size="sm" variant="ghost" onClick={() => setMode("subtask")}>
                      <Plus /> Add subtask
                    </Button>
                  )}
                </div>
                {detail.subtasks.length ? (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {detail.subtasks.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline"
                          onClick={() => {
                            const sp = new URLSearchParams(params.toString());
                            sp.set("task", s.id);
                            router.push(`${pathname}?${sp.toString()}`, { scroll: false });
                          }}
                        >
                          {s.title}
                        </button>
                        <StatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">No subtasks.</p>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-[13px] font-semibold">Attachments</h3>
              <div className="flex flex-col gap-3">
                <FileList files={files} />
                <FileUploader projectId={task.projectId} taskId={task.id} canShare={false} bucket={bucket} label="Attach file" />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-[13px] font-semibold">Log time</h3>
              <TimeEntryForm projectId={task.projectId} taskId={task.id} />
            </section>

            <section>
              <h3 className="mb-3 text-[13px] font-semibold">Comments ({detail.comments.length})</h3>
              <ul className="mb-4 flex flex-col gap-4">
                {detail.comments.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.authorName ?? "Former member"} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <span className="font-medium">{c.authorName ?? "Former member"}</span>{" "}
                        <span className="text-xs text-muted"><LocalTime value={c.createdAt} /></span>
                      </p>
                      <p className="mt-0.5 text-[13px] whitespace-pre-wrap break-words">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <CommentForm taskId={task.id} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
