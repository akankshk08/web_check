"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { errorOf, Field, fieldProps } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/server/actions/auth";

/** Submit + navigate with a full refresh so the new session cookie is used everywhere. */
function useAuthSubmit() {
  const router = useRouter();
  return async (res: ActionResult<{ redirectTo: string } | null>, setError?: (field: string, msg: string) => void) => {
    if (!res.ok) {
      toast.error(res.error);
      for (const [k, v] of Object.entries(res.fieldErrors ?? {})) if (v?.[0]) setError?.(k, v[0]);
      return false;
    }
    if (res.data?.redirectTo) {
      router.replace(res.data.redirectTo);
      router.refresh();
    }
    return true;
  };
}

export function LoginForm({ next }: { next?: string }) {
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const handle = useAuthSubmit();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => handle(await loginAction({ ...v, next }), (k, m) => form.setError(k as "email", { message: m })))}
    >
      <Field label="Email" htmlFor="email" error={errorOf(form, "email")}>
        <Input type="email" autoComplete="email" autoFocus {...fieldProps(form, "email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errorOf(form, "password")}>
        <Input type="password" autoComplete="current-password" {...fieldProps(form, "password")} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-[13px] text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", agencyName: "", email: "", password: "" },
  });
  const handle = useAuthSubmit();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => handle(await registerAction(v), (k, m) => form.setError(k as "email", { message: m })))}
    >
      <Field label="Your name" htmlFor="fullName" error={errorOf(form, "fullName")}>
        <Input autoComplete="name" autoFocus {...fieldProps(form, "fullName")} />
      </Field>
      <Field label="Agency name" htmlFor="agencyName" error={errorOf(form, "agencyName")}>
        <Input autoComplete="organization" {...fieldProps(form, "agencyName")} />
      </Field>
      <Field label="Work email" htmlFor="email" error={errorOf(form, "email")}>
        <Input type="email" autoComplete="email" {...fieldProps(form, "email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errorOf(form, "password")} hint="At least 8 characters.">
        <Input type="password" autoComplete="new-password" {...fieldProps(form, "password")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Create workspace
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  if (sent) {
    return (
      <p className="rounded-md bg-success-soft p-4 text-[13px] text-success" role="status">
        If an account exists for that email, we’ve sent a link to reset your password. It expires shortly, so use it soon.
      </p>
    );
  }
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await forgotPasswordAction(v);
        if (!res.ok) toast.error(res.error);
        else setSent(true);
      })}
    >
      <Field label="Email" htmlFor="email" error={errorOf(form, "email")}>
        <Input type="email" autoComplete="email" autoFocus {...fieldProps(form, "email")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const handle = useAuthSubmit();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => {
        const ok = await handle(await resetPasswordAction(v));
        if (ok) toast.success("Password updated.");
      })}
    >
      <Field label="New password" htmlFor="password" error={errorOf(form, "password")} hint="At least 8 characters.">
        <Input type="password" autoComplete="new-password" autoFocus {...fieldProps(form, "password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errorOf(form, "confirmPassword")}>
        <Input type="password" autoComplete="new-password" {...fieldProps(form, "confirmPassword")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
