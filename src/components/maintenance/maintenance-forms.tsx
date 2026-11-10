"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { maintenanceStatusEnum, maintenanceTypeEnum } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { deliverySchema, maintenanceSchema } from "@/lib/validations/entities";
import { createMaintenanceAction, deleteMaintenanceAction, updateMaintenanceAction, upsertDeliveryAction } from "@/server/actions/business";

type DeliveryValues = z.infer<typeof deliverySchema>;
type RecordValues = z.infer<typeof maintenanceSchema>;

export function DeliveryForm({ initial }: { initial: DeliveryValues }) {
  const form = useForm<DeliveryValues>({ resolver: zodResolver(deliverySchema), defaultValues: initial });
  const onSubmit = useActionSubmit(form, upsertDeliveryAction, { success: "Delivery details saved." });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Production URL" htmlFor="productionUrl" error={errorOf(form, "productionUrl")}>
        <Input type="url" placeholder="https://" {...fieldProps(form, "productionUrl")} />
      </Field>
      <FormGrid>
        <Field label="Hosting provider" htmlFor="hostingProvider" error={errorOf(form, "hostingProvider")}>
          <Input {...fieldProps(form, "hostingProvider")} placeholder="e.g. Vercel" />
        </Field>
        <Field label="Domain provider" htmlFor="domainProvider" error={errorOf(form, "domainProvider")}>
          <Input {...fieldProps(form, "domainProvider")} placeholder="e.g. Namecheap" />
        </Field>
        <Field label="Domain expiry" htmlFor="domainExpiry" error={errorOf(form, "domainExpiry")}>
          <Input type="date" {...fieldProps(form, "domainExpiry")} />
        </Field>
        <Field label="SSL expiry" htmlFor="sslExpiry" error={errorOf(form, "sslExpiry")}>
          <Input type="date" {...fieldProps(form, "sslExpiry")} />
        </Field>
        <Field label="Deployment date" htmlFor="deployedOn" error={errorOf(form, "deployedOn")}>
          <Input type="date" {...fieldProps(form, "deployedOn")} />
        </Field>
      </FormGrid>
      <Field label="Handover notes" htmlFor="handoverNotes" error={errorOf(form, "handoverNotes")} hint="Credentials do not belong here — share them through a password manager.">
        <Textarea rows={4} {...fieldProps(form, "handoverNotes")} />
      </Field>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Save delivery details
      </Button>
    </form>
  );
}

function RecordForm({ projectId, record, onDone }: { projectId: string; record?: RecordValues & { id: string }; onDone: () => void }) {
  const form = useForm<RecordValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: record ?? { projectId, type: "UPDATE", title: "", description: "", status: "SCHEDULED", scheduledFor: "", completedOn: "", hours: "" },
  });
  const onSubmit = useActionSubmit(form, (v: RecordValues) => (record ? updateMaintenanceAction({ ...v, id: record.id }) : createMaintenanceAction(v)), {
    success: record ? "Record updated." : "Maintenance recorded.",
    onSuccess: onDone,
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Title" htmlFor="title" error={errorOf(form, "title")} required>
        <Input {...fieldProps(form, "title")} placeholder="e.g. WordPress core update" />
      </Field>
      <FormGrid>
        <Field label="Type" htmlFor="type" error={errorOf(form, "type")}>
          <Select {...fieldProps(form, "type")}>
            {maintenanceTypeEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={errorOf(form, "status")}>
          <Select {...fieldProps(form, "status")}>
            {maintenanceStatusEnum.enumValues.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scheduled for" htmlFor="scheduledFor" error={errorOf(form, "scheduledFor")}>
          <Input type="date" {...fieldProps(form, "scheduledFor")} />
        </Field>
        <Field label="Completed on" htmlFor="completedOn" error={errorOf(form, "completedOn")}>
          <Input type="date" {...fieldProps(form, "completedOn")} />
        </Field>
        <Field label="Hours" htmlFor="hours" error={errorOf(form, "hours")}>
          <Input inputMode="decimal" {...fieldProps(form, "hours")} />
        </Field>
      </FormGrid>
      <Field label="Details" htmlFor="description" error={errorOf(form, "description")}>
        <Textarea rows={3} {...fieldProps(form, "description")} />
      </Field>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        {record ? "Save" : "Add record"}
      </Button>
    </form>
  );
}

export function MaintenanceRecordDialog({ projectId, record }: { projectId: string; record?: RecordValues & { id: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {record ? (
          <Button size="icon-sm" variant="ghost" aria-label="Edit record">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Add record
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={record ? "Edit maintenance record" : "New maintenance record"} size="lg">
        <RecordForm projectId={projectId} record={record} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMaintenanceButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      size="icon-sm"
      variant="ghost"
      aria-label="Delete record"
      action={() => deleteMaintenanceAction({ id })}
      title="Delete maintenance record?"
      description="This record will be permanently removed from the maintenance history."
      confirmLabel="Delete"
      success="Record deleted."
    >
      <Trash2 />
    </ConfirmButton>
  );
}
