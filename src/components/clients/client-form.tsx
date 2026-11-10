"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { clientStatusEnum } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { clientSchema } from "@/lib/validations/entities";
import { createClientAction, updateClientAction } from "@/server/actions/clients";

type Values = z.infer<typeof clientSchema>;

export function ClientForm({ client, onDone }: { client?: Values & { id: string }; onDone?: () => void }) {
  const form = useForm<Values>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? { name: client.name, email: client.email, companyName: client.companyName, phone: client.phone, address: client.address, notes: client.notes, status: client.status }
      : { name: "", email: "", companyName: "", phone: "", address: "", notes: "", status: "ACTIVE" },
  });
  const onSubmit = useActionSubmit(
    form,
    (v: Values) => (client ? updateClientAction({ ...v, id: client.id }) : createClientAction(v)),
    client
      ? { success: "Client updated.", onSuccess: onDone }
      : { success: "Client added.", redirectTo: (d) => `/app/clients/${(d as { id: string }).id}` },
  );
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormGrid>
        <Field label="Contact name" htmlFor="name" error={errorOf(form, "name")} required>
          <Input {...fieldProps(form, "name")} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="email" error={errorOf(form, "email")} required>
          <Input type="email" {...fieldProps(form, "email")} autoComplete="off" />
        </Field>
        <Field label="Company" htmlFor="companyName" error={errorOf(form, "companyName")}>
          <Input {...fieldProps(form, "companyName")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errorOf(form, "phone")}>
          <Input type="tel" {...fieldProps(form, "phone")} />
        </Field>
      </FormGrid>
      <Field label="Address" htmlFor="address" error={errorOf(form, "address")}>
        <Textarea rows={2} {...fieldProps(form, "address")} />
      </Field>
      <Field label="Status" htmlFor="status" error={errorOf(form, "status")} className="sm:max-w-xs">
        <Select {...fieldProps(form, "status")}>
          {clientStatusEnum.enumValues.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Internal notes" htmlFor="notes" error={errorOf(form, "notes")} hint="Only visible to your team — never shown in the client portal.">
        <Textarea rows={3} {...fieldProps(form, "notes")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {client ? "Save changes" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
