import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CallToAction, FeatureGrid, ProductPreview, SecurityStrip } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 lg:pt-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-success" /> Built for web & software agencies
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">One workspace. Every project. Every client.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              AgencyOS brings projects, tasks, milestone approvals, client portals, files, invoices and website maintenance into a single, secure
              workspace for your agency.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Start free <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/features">See features</Link>
              </Button>
            </div>
          </div>
          <div className="mt-14">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight">Everything between “kick-off” and “handover”.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Replace the spreadsheet, the shared drive, the approval emails and the invoicing tool with one connected system.</p>
        </div>
        <div className="mt-10">
          <FeatureGrid />
        </div>
      </section>

      <section className="border-y border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">A portal your clients will actually use.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Clients see progress, upcoming milestones and shared deliverables. They approve work or request changes in one click, raise support
              tickets and download invoices — without ever seeing your internal tasks or notes.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Made for teams that ship websites.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Record production URLs, hosting and domain providers, domain and SSL expiry dates, handover notes and a full maintenance log for every
              site you deliver. AgencyOS stores what you enter — it doesn’t pretend to monitor your sites.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SecurityStrip />
      </section>
      <CallToAction />
    </>
  );
}
