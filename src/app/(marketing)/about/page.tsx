import type { Metadata } from "next";
import { CallToAction, MarketingHero, SecurityStrip } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <MarketingHero
        eyebrow="About"
        title="Built by people who have run client projects."
        body="Agencies juggle projects, people, approvals and invoices across too many tools. AgencyOS exists to put the whole client relationship in one calm, trustworthy place."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 text-[15px] leading-relaxed text-muted sm:px-6">
        <p>
          We believe client work goes best when everyone can see the same picture: what’s being built, what’s waiting for approval, what’s been
          delivered and what’s been paid. AgencyOS gives your team a focused workspace and gives your clients a clear, honest window into it.
        </p>
        <p className="mt-5">
          Security is part of the product, not an afterthought. Each agency’s workspace is isolated, every action is permission-checked on the
          server, and files are stored privately and shared only through short-lived links.
        </p>
        <div className="mt-12">
          <SecurityStrip />
        </div>
      </section>
      <CallToAction />
    </>
  );
}
