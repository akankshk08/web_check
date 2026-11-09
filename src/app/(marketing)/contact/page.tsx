import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { MarketingHero } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <MarketingHero eyebrow="Contact" title="Talk to us." body="Questions about AgencyOS, onboarding your team or migrating from other tools? Send us a message." />
      <section className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <ContactForm />
      </section>
    </>
  );
}
