"use client";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/** Label + control + error/hint, wired for accessibility. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** a11y props for a registered field. */
export function fieldProps<T extends FieldValues>(form: UseFormReturn<T>, name: Path<T>) {
  const error = form.formState.errors[name]?.message as string | undefined;
  return {
    id: name as string,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${name}-error` : undefined,
    ...form.register(name),
  };
}

export function errorOf<T extends FieldValues>(form: UseFormReturn<T>, name: Path<T>) {
  return form.formState.errors[name]?.message as string | undefined;
}

/**
 * Submits validated form values to a server action. Shows the server's message,
 * maps server-side field errors onto the form, and only reports success when the server says so.
 */
export function useActionSubmit<T extends FieldValues, R>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionResult<R>>,
  opts: { success?: string; onSuccess?: (data: R) => void; redirectTo?: (data: R) => string; refresh?: boolean } = {},
) {
  const router = useRouter();
  return form.handleSubmit(async (values) => {
    const res = await action(values);
    if (!res.ok) {
      toast.error(res.error);
      for (const [key, msgs] of Object.entries(res.fieldErrors ?? {})) {
        if (msgs?.[0]) form.setError(key as Path<T>, { message: msgs[0] });
      }
      return;
    }
    if (opts.success) toast.success(opts.success);
    opts.onSuccess?.(res.data);
    if (opts.redirectTo) router.push(opts.redirectTo(res.data));
    else if (opts.refresh !== false) router.refresh();
  });
}

/** Runs a server action from a button (no form), with toast + refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <R,>(fn: () => Promise<ActionResult<R>>, opts: { success?: string; onSuccess?: (d: R) => void; redirectTo?: string } = {}) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          resolve(false);
          return;
        }
        if (opts.success) toast.success(opts.success);
        opts.onSuccess?.(res.data);
        if (opts.redirectTo) router.push(opts.redirectTo);
        else router.refresh();
        resolve(true);
      }),
    );
  return { pending, run };
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
