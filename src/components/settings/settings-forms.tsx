"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { orgSettingsSchema, profileSchema, transferOwnershipSchema } from "@/lib/validations/entities";
import { transferOwnershipAction, updateOrganizationAction, updateProfileAction } from "@/server/actions/team";

export function ProfileForm({ initial, email }: { initial: z.infer<typeof profileSchema>; email: string }) {
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: initial });
  const onSubmit = useActionSubmit(form, updateProfileAction, { success: "Profile saved." });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormGrid>
        <Field label="Full name" htmlFor="fullName" error={errorOf(form, "fullName")} required>
          <Input autoComplete="name" {...fieldProps(form, "fullName")} />
        </Field>
        <Field label="Email" htmlFor="profile-email" hint="Your sign-in email can’t be changed here.">
          <Input id="profile-email" value={email} disabled readOnly />
        </Field>
        <Field label="Job title" htmlFor="jobTitle" error={errorOf(form, "jobTitle")}>
          <Input {...fieldProps(form, "jobTitle")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errorOf(form, "phone")}>
          <Input type="tel" autoComplete="tel" {...fieldProps(form, "phone")} />
        </Field>
      </FormGrid>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Save profile
      </Button>
    </form>
  );
}

export function OrganizationForm({ initial }: { initial: z.infer<typeof orgSettingsSchema> }) {
  const form = useForm<z.infer<typeof orgSettingsSchema>>({ resolver: zodResolver(orgSettingsSchema), defaultValues: initial });
  const onSubmit = useActionSubmit(form, updateOrganizationAction, { success: "Workspace settings saved." });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormGrid>
        <Field label="Agency name" htmlFor="name" error={errorOf(form, "name")} required>
          <Input {...fieldProps(form, "name")} />
        </Field>
        <Field label="Billing email" htmlFor="email" error={errorOf(form, "email")}>
          <Input type="email" {...fieldProps(form, "email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errorOf(form, "phone")}>
          <Input {...fieldProps(form, "phone")} />
        </Field>
        <Field label="Website" htmlFor="website" error={errorOf(form, "website")}>
          <Input type="url" placeholder="https://" {...fieldProps(form, "website")} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={errorOf(form, "currency")} hint="Used for new invoices.">
          <Input maxLength={3} className="uppercase" {...fieldProps(form, "currency")} />
        </Field>
        <Field label="Default tax rate (%)" htmlFor="defaultTaxRate" error={errorOf(form, "defaultTaxRate")}>
          <Input inputMode="decimal" {...fieldProps(form, "defaultTaxRate")} />
        </Field>
        <Field label="Invoice prefix" htmlFor="invoicePrefix" error={errorOf(form, "invoicePrefix")} hint="e.g. INV → INV-0001">
          <Input className="uppercase" {...fieldProps(form, "invoicePrefix")} />
        </Field>
      </FormGrid>
      <Field label="Address" htmlFor="address" error={errorOf(form, "address")} hint="Shown on invoices.">
        <Textarea rows={2} {...fieldProps(form, "address")} />
      </Field>
      <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
        Save workspace
      </Button>
    </form>
  );
}

export function TransferOwnershipForm({ members }: { members: { memberId: string; fullName: string; role: string }[] }) {
  const form = useForm<z.infer<typeof transferOwnershipSchema>>({
    resolver: zodResolver(transferOwnershipSchema),
    defaultValues: { memberId: "", confirm: "" as "TRANSFER" },
  });
  const onSubmit = useActionSubmit(form, transferOwnershipAction, { success: "Ownership transferred. You are now an admin." });
  if (members.length === 0) return <p className="text-[13px] text-muted">Invite another team member before transferring ownership.</p>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormGrid>
        <Field label="New owner" htmlFor="memberId" error={errorOf(form, "memberId")}>
          <Select {...fieldProps(form, "memberId")}>
            <option value="">Select a member…</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label='Type "TRANSFER" to confirm' htmlFor="confirm" error={errorOf(form, "confirm") ? "Type TRANSFER exactly" : undefined}>
          <Input autoComplete="off" {...fieldProps(form, "confirm")} />
        </Field>
      </FormGrid>
      <Button type="submit" variant="danger" className="self-end" loading={form.formState.isSubmitting}>
        Transfer ownership
      </Button>
    </form>
  );
}
