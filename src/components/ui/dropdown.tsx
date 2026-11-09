"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-pop", className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Item> & { destructive?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] outline-none select-none data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted",
        destructive && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2.5 py-1.5 text-xs text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}
