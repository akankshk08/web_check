import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  FileCheck2,
  FolderKanban,
  Globe2,
  Lock,
  Receipt,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FolderKanban, title: "Projects & tasks", body: "Plan projects with milestones, assign work, and track it on a Kanban board or list — with subtasks, comments and attachments." },
  { icon: FileCheck2, title: "Client approvals", body: "Submit milestones for review. Clients approve or request changes from their portal, and every decision is kept on record." },
  { icon: Users, title: "Client portal", body: "Give clients a calm, branded view of progress, deliverables, shared files and invoices — never your internal notes." },
  { icon: Receipt, title: "Invoicing", body: "Create invoices with exact tax calculations, record payments, track what’s overdue and download PDFs." },
  { icon: Globe2, title: "Delivery & maintenance", body: "Keep production URLs, hosting, domain and SSL dates, handover notes and maintenance history for every site you ship." },
  { icon: BarChart3, title: "Reports", body: "Revenue by month, outstanding invoices, team workload and completion trends — calculated from your real records." },
];

export function ProductPreview() {
  const cols = [
    { title: "To do", tone: "#697386", cards: ["Wireframe checkout", "Content audit"] },
    { title: "In progress", tone: "#536DFE", cards: ["Payment integration", "Product page UI"] },
    { title: "In review", tone: "#3B82C4", cards: ["Homepage design"] },
    { title: "Completed", tone: "#16A36A", cards: ["Brand guidelines", "Sitemap"] },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-pop" aria-hidden>
      <div className="flex">
        <div className="hidden w-44 shrink-0 flex-col gap-1 bg-sidebar p-3 sm:flex">
          <div className="mb-3 h-5 w-24 rounded bg-sidebar-muted" />
          {["Dashboard", "Projects", "Clients", "Team", "Invoices", "Reports"].map((n, i) => (
            <div key={n} className={`rounded-md px-2 py-1.5 text-[11px] ${i === 1 ? "bg-sidebar-muted text-white" : "text-sidebar-foreground"}`}>
              {n}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">E-commerce Website</div>
              <div className="text-[11px] text-muted">Northwind Coffee · Due Dec 12</div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-subtle">
                <div className="h-full w-[62%] rounded-full bg-primary" />
              </div>
              62%
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {cols.map((c) => (
              <div key={c.title} className="rounded-lg bg-subtle/70 p-2">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium">
                  <span className="size-1.5 rounded-full" style={{ background: c.tone }} />
                  {c.title}
                </div>
                <div className="flex flex-col gap-1.5">
                  {c.cards.map((card) => (
                    <div key={card} className="rounded-md border border-border bg-surface p-2 text-[11px] shadow-card">
                      {card}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="rounded bg-primary-soft px-1 text-[9px] text-primary">Frontend</span>
                        <span className="size-3.5 rounded-full bg-[#8B5CF6]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-surface p-6">
          <f.icon className="size-5 text-primary" aria-hidden />
          <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

export function SecurityStrip() {
  const items = [
    { icon: Lock, text: "Every agency’s data is isolated at the application and database level." },
    { icon: ShieldCheck, text: "Role-based access for owners, admins, employees and clients." },
    { icon: CheckCircle2, text: "Private file storage with short-lived, permission-checked links." },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((i) => (
        <div key={i.text} className="flex gap-3">
          <i.icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">{i.text}</p>
        </div>
      ))}
    </div>
  );
}

export function CallToAction() {
  return (
    <section className="bg-sidebar">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Run your agency from one place.</h2>
          <p className="mt-2 text-sm text-sidebar-foreground">Create a workspace in a minute. Invite your team and clients when you’re ready.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/register">Create your workspace</Link>
        </Button>
      </div>
    </section>
  );
}

export function MarketingHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-[13px] font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{body}</p>
      </div>
    </section>
  );
}
