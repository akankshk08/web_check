"use client";
import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./form";

/** Destructive/important actions always go through a confirmation dialog. */
export function ConfirmButton<R>({
  action,
  title,
  description,
  confirmLabel,
  success,
  redirectTo,
  tone = "danger",
  children,
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<R>>;
  title: string;
  description: string;
  confirmLabel: string;
  success?: string;
  redirectTo?: string;
  tone?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button {...buttonProps}>{children}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        tone={tone}
        pending={pending}
        onConfirm={async (e) => {
          e.preventDefault();
          const ok = await run(action, { success, redirectTo });
          if (ok) setOpen(false);
        }}
      />
    </AlertDialog>
  );
}
