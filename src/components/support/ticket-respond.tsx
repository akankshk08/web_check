"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { ticketStatusEnum, type TicketStatus } from "@/db/schema/enums";
import { humanize } from "@/lib/utils";
import { ticketUpdateSchema } from "@/lib/validations/entities";
import { updateTicketAction } from "@/server/actions/business";

export function RespondToTicket({ ticket }: { ticket: { id: string; subject: string; description: string; status: TicketStatus; staffResponse: string | null } }) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof ticketUpdateSchema>>({
    resolver: zodResolver(ticketUpdateSchema),
    defaultValues: { id: ticket.id, status: ticket.status, staffResponse: ticket.staffResponse ?? "" },
  });
  const onSubmit = useActionSubmit(form, updateTicketAction, { success: "Ticket updated.", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Respond
        </Button>
      </DialogTrigger>
      <DialogContent title={ticket.subject}>
        <p className="mb-4 rounded-md bg-subtle p-3 text-[13px] whitespace-pre-wrap">{ticket.description}</p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Status" htmlFor="status" error={errorOf(form, "status")}>
            <Select {...fieldProps(form, "status")}>
              {ticketStatusEnum.enumValues.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Response to client" htmlFor="staffResponse" error={errorOf(form, "staffResponse")} hint="Visible to the client in their portal.">
            <Textarea rows={4} {...fieldProps(form, "staffResponse")} />
          </Field>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
