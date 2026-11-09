"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { priorityEnum, projectStatusEnum, projectTypeEnum } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { projectSchema } from "@/lib/validations/entities";
import { createProjectAction, updateProjectAction } from "@/server/actions/projects";

type Values = z.infer<typeof projectSchema>;

export function ProjectForm({
  project,
  clients,
  staff,
  defaultClientId,
  onDone,
}: {
  project?: Values & { id: string };
  clients: { id: string; name: string; companyName: string | null }[];
  staff: { userId: string; fullName: string; role: string }[];
  defaultClientId?: string;
  onDone?: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(projectSchema),
    defaultValues: project ?? {
      name: "",
      description: "",
      internalNotes: "",
      clientId: defaultClientId ?? "",
      type: "WEBSITE",
      status: "PLANNING",
      priority: "MEDIUM",
      budget: "",
      startDate: "",
      dueDate: "",
      memberIds: [],
    },
  });
  const onSubmit = useActionSubmit(
    form,
    (v: Values) => (project ? updateProjectAction({ ...v, id: project.id }) : createProjectAction(v)),
    project ? { success: "Project updated.", onSuccess: onDone } : { success: "Project created.", redirectTo: (d) => `/app/projects/${(d as { id: string }).id}` },
  );
  const memberIds = form.watch("memberIds");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Project name" htmlFor="name" error={errorOf(form, "name")} required>
        <Input {...fieldProps(form, "name")} placeholder="e.g. E-commerce website" />
      </Field>
      <FormGrid>
        <Field label="Client" htmlFor="clientId" error={errorOf(form, "clientId")} required>
          <Select {...fieldProps(form, "clientId")}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName ? `${c.companyName} (${c.name})` : c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project type" htmlFor="type" error={errorOf(form, "type")}>
          <Select {...fieldProps(form, "type")}>
            {projectTypeEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={errorOf(form, "status")}>
          <Select {...fieldProps(form, "status")}>
            {projectStatusEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" error={errorOf(form, "priority")}>
          <Select {...fieldProps(form, "priority")}>
            {priorityEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
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
        <Field label="Budget" htmlFor="budget" error={errorOf(form, "budget")} hint="Only visible to owners and admins.">
          <Input inputMode="decimal" placeholder="0.00" {...fieldProps(form, "budget")} />
        </Field>
      </FormGrid>
      <Field label="Description" htmlFor="description" error={errorOf(form, "description")} hint="Shown to the client in their portal.">
        <Textarea rows={3} {...fieldProps(form, "description")} />
      </Field>
      <Field label="Internal notes" htmlFor="internalNotes" error={errorOf(form, "internalNotes")} hint="Only visible to owners and admins.">
        <Textarea rows={2} {...fieldProps(form, "internalNotes")} />
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium">Team members</legend>
        <p className="mb-2 text-xs text-muted">Assigned employees can see this project, its tasks and files.</p>
        {staff.length === 0 ? (
          <p className="text-[13px] text-muted">Invite team members first.</p>
        ) : (
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
            {staff.map((s) => (
              <label key={s.userId} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-subtle">
                <Checkbox
                  checked={memberIds.includes(s.userId)}
                  onChange={(e) =>
                    form.setValue("memberIds", e.target.checked ? [...memberIds, s.userId] : memberIds.filter((x) => x !== s.userId), { shouldDirty: true })
                  }
                />
                <span className="flex-1 truncate">{s.fullName}</span>
                <span className="text-[11px] text-muted">{humanize(s.role)}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
