import type { Metadata } from "next";
import { CallToAction, FeatureGrid, MarketingHero } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Features" };

const ROLES = [
  { role: "Owners", body: "Full control of the workspace, team, finances and settings — including transferring ownership." },
  { role: "Admins", body: "Run clients, projects, milestones and deliverables. Finance access is granted by the owner." },
  { role: "Employees", body: "A focused view of assigned projects and tasks, deadlines, files and timesheets." },
  { role: "Clients", body: "A private portal for progress, approvals, shared files, invoices and support tickets." },
];

export default function FeaturesPage() {
  return (
    <>
      <MarketingHero eyebrow="Features" title="The whole agency workflow, connected." body="From the first milestone to the final invoice and every maintenance visit after launch." />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <FeatureGrid />
      </section>
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Four roles, each with exactly the access they need</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.role} className="rounded-lg border border-border bg-surface p-5">
                <h3 className="text-sm font-semibold">{r.role}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}
