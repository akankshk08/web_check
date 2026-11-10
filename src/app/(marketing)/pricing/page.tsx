import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingHero } from "@/components/marketing/sections";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  { name: "Starter", price: "$0", note: "For freelancers and small studios getting started.", features: ["Up to 3 team members", "Unlimited clients", "Projects, tasks & milestones", "Client portal"], cta: "Start free" },
  { name: "Studio", price: "$49", note: "Per workspace / month. For growing agencies.", features: ["Up to 15 team members", "Invoicing & PDF invoices", "Delivery & maintenance records", "Reports"], cta: "Start with Studio", featured: true },
  { name: "Agency", price: "$129", note: "Per workspace / month. For established teams.", features: ["Unlimited team members", "Everything in Studio", "Priority support", "Onboarding assistance"], cta: "Start with Agency" },
];

export default function PricingPage() {
  return (
    <>
      <MarketingHero eyebrow="Pricing" title="Simple pricing per workspace." body="Every plan includes the client portal and unlimited clients. Billing is not yet enabled — every workspace currently runs on the full feature set." />
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:px-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={cn("flex flex-col rounded-xl border bg-surface p-6", p.featured ? "border-primary shadow-pop" : "border-border")}>
            <h2 className="text-sm font-semibold">{p.name}</h2>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{p.price}</p>
            <p className="mt-1 text-[13px] text-muted">{p.note}</p>
            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[13px]">
                  <Check className="size-4 text-success" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6" variant={p.featured ? "primary" : "secondary"}>
              <Link href="/register">{p.cta}</Link>
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}
