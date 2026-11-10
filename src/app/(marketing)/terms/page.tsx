import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of AgencyOS, provided by {LEGAL.companyName} (“we”). By creating an account or using AgencyOS you agree to them. Contact:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">{LEGAL.contactEmail}</a>.
      </p>

      <h2>The service</h2>
      <p>
        AgencyOS lets agencies manage clients, projects, tasks, approvals, files, invoices and website maintenance records, and gives their clients a portal.
        Payments shown in AgencyOS are recorded manually. AgencyOS does not process payments. Domain and SSL dates are entered by users, and AgencyOS does not monitor websites.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must give accurate information and keep your password secure. You’re responsible for activity under your account.</li>
        <li>The person who creates a workspace is its owner and controls who has access to it.</li>
        <li>You may delete your account at any time in Settings.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don’t use AgencyOS to break the law, upload malware, infringe others’ rights, try to access other workspaces, or disrupt the service.</p>

      <h2>Your content</h2>
      <p>
        You (or your agency) own the content you add. You give us permission to store, process and display it only as needed to provide the service. You’re responsible
        for having the right to store information about your clients and team.
      </p>

      <h2>Fees</h2>
      <p>The service is currently provided without charge. If paid plans are introduced, prices and terms will be shown before you’re asked to pay.</p>

      <h2>Termination</h2>
      <p>We may suspend accounts that break these terms. You may stop using AgencyOS and delete your account at any time.</p>

      <h2>Disclaimers and liability</h2>
      <p>
        AgencyOS is provided “as is”. We work to keep it available and secure, but we don’t guarantee it will be uninterrupted or error-free. Keep your own copies of
        important documents such as invoices. To the extent the law allows, we aren’t liable for indirect or consequential losses.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL.governingLaw}.</p>

      <h2>Changes</h2>
      <p>We may update these terms. We’ll change the date above and notify account owners of significant changes.</p>

      <p className="pt-6 text-[13px]">
        See also our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
