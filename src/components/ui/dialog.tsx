"use client";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay = "fixed inset-0 z-50 bg-[#0f1420]/40 data-[state=open]:animate-in";
const panel =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface shadow-pop focus:outline-none max-h-[calc(100dvh-2rem)] overflow-y-auto";

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(panel, size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg", className)}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">{description}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const AlertDialog = AlertPrimitive.Root;
export const AlertDialogTrigger = AlertPrimitive.Trigger;

export function AlertDialogContent({
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  tone = "danger",
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (e: React.MouseEvent) => void;
  pending?: boolean;
  tone?: "danger" | "primary";
  children?: React.ReactNode;
}) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className={overlay} />
      <AlertPrimitive.Content className={cn(panel, "max-w-md p-5")}>
        <AlertPrimitive.Title className="text-[15px] font-semibold">{title}</AlertPrimitive.Title>
        <AlertPrimitive.Description className="mt-2 text-[13px] leading-relaxed text-muted">{description}</AlertPrimitive.Description>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <AlertPrimitive.Cancel className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-subtle">
            Cancel
          </AlertPrimitive.Cancel>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60",
              tone === "danger" ? "bg-danger hover:bg-danger-hover" : "bg-primary hover:bg-primary-hover",
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </AlertPrimitive.Content>
    </AlertPrimitive.Portal>
  );
}
