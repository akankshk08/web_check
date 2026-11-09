import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-based tabs (server-rendered, work without JS). */
export function LinkTabs({ tabs, active }: { tabs: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
            t.key === active ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded bg-subtle px-1.5 text-[11px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
