import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-[13px] text-muted" aria-label="Breadcrumb">
          {breadcrumbs.map((b) => (
            <span key={b.href} className="flex items-center gap-1">
              <Link href={b.href} className="hover:text-foreground">
                {b.label}
              </Link>
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-[13px] text-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-subtle text-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "neutral" | "danger" | "warning" | "success";
  href?: string;
}) {
  const toneClass = { neutral: "text-primary bg-primary-soft", danger: "text-danger bg-danger-soft", warning: "text-[#a86f0c] bg-warning-soft", success: "text-success bg-success-soft" }[tone];
  const body = (
    <Card className={cn("p-4", href && "transition-colors hover:border-[#d5dae3]")}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{label}</p>
        <span className={cn("flex size-7 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="mt-0.5 text-sm break-words">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
