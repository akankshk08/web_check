"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { inviteClientSchema } from "@/lib/validations/entities";
import { archiveClientAction, inviteClientUserAction } from "@/server/actions/clients";
import { ClientForm } from "./client-form";

type ClientValues = Parameters<typeof ClientForm>[0]["client"];

export function EditClientButton({ client }: { client: NonNullable<ClientValues> }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit client" size="lg">
        <ClientForm client={client} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveClientButton({ id, archived }: { id: string; archived: boolean }) {
  return archived ? (
    <ConfirmButton
      variant="secondary"
      tone="primary"
      action={() => archiveClientAction({ id, archived: false })}
      title="Restore client?"
      description="The client will appear in lists again and can be assigned to new projects."
      confirmLabel="Restore"
      success="Client restored."
    >
      Restore
    </ConfirmButton>
  ) : (
    <ConfirmButton
      variant="secondary"
      action={() => archiveClientAction({ id, archived: true })}
      title="Archive client?"
      description="Archived clients are hidden from lists and their portal users lose access. Projects and invoices are kept. You can restore the client later."
      confirmLabel="Archive client"
      success="Client archived."
    >
      Archive
    </ConfirmButton>
  );
}

export function InviteClientUserForm({ clientId, defaultEmail }: { clientId: string; defaultEmail: string }) {
  const [link, setLink] = useState<string | null>(null);
  const form = useForm<z.infer<typeof inviteClientSchema>>({ resolver: zodResolver(inviteClientSchema), defaultValues: { clientId, email: defaultEmail } });
  const onSubmit = useActionSubmit(form, inviteClientUserAction, {
    success: "Invitation sent.",
    onSuccess: (d) => {
      setLink(d.url);
      form.reset({ clientId, email: "" });
    },
  });
  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Field label="Invite to portal" htmlFor="email" error={errorOf(form, "email")} className="flex-1">
          <Input type="email" placeholder="person@client.com" {...fieldProps(form, "email")} />
        </Field>
        <Button type="submit" className="sm:mt-6" loading={form.formState.isSubmitting}>
          Send invite
        </Button>
      </form>
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-subtle p-2 text-xs">
          <span className="truncate text-muted">{link}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copied.");
            }}
          >
            <Copy /> Copy
          </Button>
        </div>
      )}
    </div>
  );
}
