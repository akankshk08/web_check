"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { errorOf, Field, fieldProps } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { password } from "@/lib/validations/auth";
import { requiredText } from "@/lib/validations/common";
import { acceptInviteAction, acceptInviteSignupAction } from "@/server/actions/auth";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptInviteAction({ token });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Invitation accepted.");
          router.replace(res.data.redirectTo);
          router.refresh();
        })
      }
    >
      Accept invitation
    </Button>
  );
}

const schema = z.object({ fullName: requiredText("Your name", 120), password });

export function InviteSignupForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { fullName: "", password: "" } });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await acceptInviteSignupAction({ token, ...v });
        if (!res.ok) return void toast.error(res.error);
        router.replace(res.data.redirectTo);
        router.refresh();
      })}
    >
      <Field label="Email" htmlFor="invite-email">
        <Input id="invite-email" value={email} disabled readOnly />
      </Field>
      <Field label="Your name" htmlFor="fullName" error={errorOf(form, "fullName")}>
        <Input autoComplete="name" autoFocus {...fieldProps(form, "fullName")} />
      </Field>
      <Field label="Choose a password" htmlFor="password" error={errorOf(form, "password")} hint="At least 8 characters.">
        <Input type="password" autoComplete="new-password" {...fieldProps(form, "password")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Create account & join
      </Button>
      <p className="text-center text-xs text-muted">
        By joining you agree to the{" "}
        <a href="/terms" className="text-primary hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
