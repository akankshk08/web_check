"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { priorityEnum, taskStatusEnum } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { taskSchema } from "@/lib/validations/entities";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";

type Values = z.infer<typeof taskSchema>;
export type TaskFormOptions = { milestones: { id: string; title: string }[]; staff: { userId: string; fullName: string }[] };

export function TaskForm({
  projectId,
  task,
  parentTaskId,
  options,
  onDone,
}: {
  projectId: string;
  task?: Omit<Values, "projectId" | "parentTaskId"> & { id: string };
  parentTaskId?: string;
  options: TaskFormOptions;
  onDone: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      projectId,
      parentTaskId: parentTaskId ?? "",
      title: task?.title ?? "",
      description: task?.description ?? "",
      milestoneId: task?.milestoneId ?? "",
      assigneeId: task?.assigneeId ?? "",
      priority: task?.priority ?? "MEDIUM",
      status: task?.status ?? "TODO",
      startDate: task?.startDate ?? "",
      dueDate: task?.dueDate ?? "",
      estimatedHours: task?.estimatedHours ?? "",
    },
  });
  const onSubmit = useActionSubmit(
    form,
    async (v: Values) => {
      if (task) {
        const { projectId: _p, parentTaskId: _pt, ...rest } = v;
        return updateTaskAction({ ...rest, id: task.id });
      }
      return createTaskAction(v);
    },
    { success: task ? "Task updated." : "Task created.", onSuccess: onDone },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Title" htmlFor="title" error={errorOf(form, "title")} required>
        <Input {...fieldProps(form, "title")} autoFocus />
      </Field>
      <Field label="Description" htmlFor="description" error={errorOf(form, "description")}>
        <Textarea rows={3} {...fieldProps(form, "description")} />
      </Field>
      <FormGrid>
        <Field label="Assignee" htmlFor="assigneeId" error={errorOf(form, "assigneeId")}>
          <Select {...fieldProps(form, "assigneeId")}>
            <option value="">Unassigned</option>
            {options.staff.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        {!parentTaskId && (
          <Field label="Milestone" htmlFor="milestoneId" error={errorOf(form, "milestoneId")}>
            <Select {...fieldProps(form, "milestoneId")}>
              <option value="">No milestone</option>
              {options.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Status" htmlFor="status" error={errorOf(form, "status")}>
          <Select {...fieldProps(form, "status")}>
            {taskStatusEnum.enumValues.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" error={errorOf(form, "priority")}>
          <Select {...fieldProps(form, "priority")}>
            {priorityEnum.enumValues.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="startDate" error={errorOf(form, "startDate")}>
          <Input type="date" {...fieldProps(form, "startDate")} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={errorOf(form, "dueDate")}>
          <Input type="date" {...fieldProps(form, "dueDate")} />
        </Field>
        <Field label="Estimated hours" htmlFor="estimatedHours" error={errorOf(form, "estimatedHours")}>
          <Input inputMode="decimal" placeholder="0" {...fieldProps(form, "estimatedHours")} />
        </Field>
      </FormGrid>
      <div className="flex justify-end">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {task ? "Save task" : parentTaskId ? "Add subtask" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
