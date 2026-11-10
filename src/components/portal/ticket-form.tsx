"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { priorityEnum } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { ticketSchema } from "@/lib/validations/entities";
import { createTicketAction } from "@/server/actions/business";

type Values = z.infer<typeof ticketSchema>;

export function TicketForm({ projects }: { projects: { id: string; name: string }[] }) {
  const empty: Values = { subject: "", description: "", projectId: "", priority: "MEDIUM" };
  const form = useForm<Values>({ resolver: zodResolver(ticketSchema), defaultValues: empty });
  const onSubmit = useActionSubmit(form, createTicketAction, { success: "Ticket submitted. The team has been notified.", onSuccess: () => form.reset(empty) });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Subject" htmlFor="subject" error={errorOf(form, "subject")} required>
        <Input {...fieldProps(form, "subject")} />
      </Field>
      <FormGrid>
        <Field label="Project" htmlFor="projectId" error={errorOf(form, "projectId")}>
          <Select {...fieldProps(form, "projectId")}>
            <option value="">General</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" error={errorOf(form, "priority")}>
          <Select {...fieldProps(form, "priority")}>
            {priorityEnum.enumValues.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
      <Field label="Describe the issue" htmlFor="description" error={errorOf(form, "description")} required>
        <Textarea rows={5} {...fieldProps(form, "description")} />
      </Field>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Submit ticket
      </Button>
    </form>
  );
}
