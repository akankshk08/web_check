"use client";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  Flag,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Receipt,
  Settings,
  UserRound,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { NavIcon, NavSection } from "./nav-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  clients: UsersRound,
  team: Users,
  calendar: CalendarDays,
  invoices: Receipt,
  reports: BarChart3,
  maintenance: Globe2,
  support: LifeBuoy,
  tasks: CheckSquare,
  timesheets: Clock,
  notifications: Bell,
  settings: Settings,
  milestones: Flag,
  files: FileText,
  profile: UserRound,
};

function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = sections.flatMap((s) => s.items);
  // Highlight the most specific matching item only.
  const active = all
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex flex-col gap-5" aria-label="Main">
      {sections.map((section, idx) => (
        <div key={section.title ?? idx}>
          {section.title && <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wide text-[#7d8597] uppercase">{section.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                      isActive ? "bg-sidebar-muted font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-muted/60 hover:text-white",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections, orgName, homeHref }: { sections: NavSection[]; orgName: string; homeHref: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href={homeHref} inverted />
      </div>
      <div className="mx-3 mb-4 truncate rounded-md border border-sidebar-muted px-2.5 py-1.5 text-xs text-sidebar-foreground" title={orgName}>
        {orgName}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        <NavLinks sections={sections} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-sidebar lg:block">{content}</aside>
      <button
        type="button"
        className="fixed top-3 left-3 z-40 inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#0f1420]/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-pop">
            <button
              type="button"
              className="absolute top-3 right-3 rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-muted"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
