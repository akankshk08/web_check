import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse-soft rounded-md bg-[#eceff4]", className)} aria-hidden {...props} />;
}

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "success" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", tone === "success" ? "bg-success" : "bg-primary")} style={{ width: `${v}%` }} />
    </div>
  );
}

const AVATAR_COLORS = ["#536DFE", "#16A36A", "#E5A12B", "#DC5252", "#3B82C4", "#8B5CF6", "#0E9F9F"];

export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: color }}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-xs text-muted">Unassigned</span>;
  return (
    <div className="flex -space-x-1.5">
      {names.slice(0, max).map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={24} />
      ))}
      {names.length > max && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}
