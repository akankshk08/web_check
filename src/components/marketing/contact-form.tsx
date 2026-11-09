"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { email, requiredText } from "@/lib/validations/common";
import { sendContactMessageAction } from "@/server/actions/contact";

const schema = z.object({ name: requiredText("Name", 120), email, company: z.string().trim().max(160), message: requiredText("Message", 4000) });
type Values = z.infer<typeof schema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", company: "", message: "" } });
  const onSubmit = useActionSubmit(form, sendContactMessageAction, { onSuccess: () => setSent(true), refresh: false });
  if (sent) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-soft p-5 text-sm text-success" role="status">
        Thanks — your message was sent. We’ll reply by email.
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errorOf(form, "name")} required>
          <Input {...fieldProps(form, "name")} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email" error={errorOf(form, "email")} required>
          <Input type="email" {...fieldProps(form, "email")} autoComplete="email" />
        </Field>
      </div>
      <Field label="Company" htmlFor="company" error={errorOf(form, "company")}>
        <Input {...fieldProps(form, "company")} autoComplete="organization" />
      </Field>
      <Field label="Message" htmlFor="message" error={errorOf(form, "message")} required>
        <Textarea rows={5} {...fieldProps(form, "message")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting} className="self-start">
        Send message
      </Button>
    </form>
  );
}
