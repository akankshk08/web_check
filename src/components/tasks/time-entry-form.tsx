"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { timeEntrySchema } from "@/lib/validations/entities";
import { logTimeAction } from "@/server/actions/tasks";

type Values = z.infer<typeof timeEntrySchema>;

/** Log hours against a project (and optionally a task). */
export function TimeEntryForm({ projectId, taskId, projects, onDone }: { projectId?: string; taskId?: string; projects?: { id: string; name: string }[]; onDone?: () => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: { projectId: projectId ?? "", taskId: taskId ?? "", workDate: todayISO(), hours: "", description: "" },
  });
  const onSubmit = useActionSubmit(form, logTimeAction, {
    success: "Time logged.",
    onSuccess: () => {
      form.reset({ ...form.getValues(), hours: "", description: "" });
      onDone?.();
    },
  });
  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end">
      {projects ? (
        <Field label="Project" htmlFor="projectId" error={errorOf(form, "projectId")}>
          <Select {...fieldProps(form, "projectId")}>
            <option value="">Select…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Date" htmlFor="workDate" error={errorOf(form, "workDate")}>
        <Input type="date" max={todayISO()} {...fieldProps(form, "workDate")} />
      </Field>
      <Field label="Hours" htmlFor="hours" error={errorOf(form, "hours")}>
        <Input inputMode="decimal" placeholder="1.5" {...fieldProps(form, "hours")} />
      </Field>
      <Field label="Note" htmlFor="description" error={errorOf(form, "description")} className={projects ? "" : "sm:col-span-2"}>
        <Input placeholder="What did you work on?" {...fieldProps(form, "description")} />
      </Field>
      <Button type="submit" variant="secondary" loading={form.formState.isSubmitting}>
        Log time
      </Button>
    </form>
  );
}
