"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { changePasswordSchema, deleteAccountSchema } from "@/lib/validations/auth";
import { changePasswordAction, deleteAccountAction } from "@/server/actions/account";

export function ChangePasswordForm() {
  const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const form = useForm<z.infer<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema), defaultValues: empty });
  const onSubmit = useActionSubmit(form, changePasswordAction, {
    success: "Password changed. Other devices have been signed out.",
    onSuccess: () => form.reset(empty),
    refresh: false,
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Current password" htmlFor="currentPassword" error={errorOf(form, "currentPassword")}>
        <Input type="password" autoComplete="current-password" {...fieldProps(form, "currentPassword")} />
      </Field>
      <FormGrid>
        <Field label="New password" htmlFor="newPassword" error={errorOf(form, "newPassword")} hint="At least 8 characters.">
          <Input type="password" autoComplete="new-password" {...fieldProps(form, "newPassword")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={errorOf(form, "confirmPassword")}>
          <Input type="password" autoComplete="new-password" {...fieldProps(form, "confirmPassword")} />
        </Field>
      </FormGrid>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Change password
      </Button>
    </form>
  );
}

export function DeleteAccountButton({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof deleteAccountSchema>>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirm: "" as "DELETE" },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Delete my account</Button>
      </DialogTrigger>
      <DialogContent title="Delete your account permanently?" description="This can't be undone.">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>Your login, profile, notifications and time entries are deleted.</li>
          <li>Comments and work you created stay with the agency, without your name.</li>
          {isOwner && (
            <li className="font-medium text-danger">
              You own this workspace. If you’re its only team member, the entire workspace — clients, projects, invoices and files — is deleted too.
              Otherwise, transfer ownership first.
            </li>
          )}
        </ul>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            const res = await deleteAccountAction(v);
            if (!res.ok) {
              toast.error(res.error);
              for (const [k, m] of Object.entries(res.fieldErrors ?? {})) if (m?.[0]) form.setError(k as "password", { message: m[0] });
              return;
            }
            router.replace(res.data.redirectTo);
            router.refresh();
          })}
        >
          <Field label="Your password" htmlFor="password" error={errorOf(form, "password")}>
            <Input type="password" autoComplete="current-password" {...fieldProps(form, "password")} />
          </Field>
          <Field label='Type "DELETE" to confirm' htmlFor="confirm" error={errorOf(form, "confirm")}>
            <Input autoComplete="off" {...fieldProps(form, "confirm")} />
          </Field>
          <Button type="submit" variant="danger" loading={form.formState.isSubmitting}>
            Permanently delete my account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
