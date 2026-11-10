"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { errorOf, Field, fieldProps } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendConfirmationSchema } from "@/lib/validations/auth";
import { resendConfirmationAction } from "@/server/actions/account";

export function ResendConfirmationForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof resendConfirmationSchema>>({ resolver: zodResolver(resendConfirmationSchema), defaultValues: { email: "" } });
  if (sent) return <p className="text-[13px] text-success">If that account is waiting for confirmation, we’ve sent a new link.</p>;
  return (
    <form
      noValidate
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await resendConfirmationAction(v);
        if (!res.ok) return void toast.error(res.error);
        setSent(true);
      })}
    >
      <Field label="Resend the confirmation email" htmlFor="email" error={errorOf(form, "email")} className="flex-1">
        <Input type="email" autoComplete="email" placeholder="you@agency.com" {...fieldProps(form, "email")} />
      </Field>
      <Button type="submit" variant="secondary" className="sm:mt-6" loading={form.formState.isSubmitting}>
        Resend
      </Button>
    </form>
  );
}
