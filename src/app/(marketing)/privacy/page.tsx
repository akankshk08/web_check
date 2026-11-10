import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information AgencyOS (operated by {LEGAL.companyName}, “we”) collects, why, who we share it with, and the choices you have.
        Questions: <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary hover:underline">{LEGAL.contactEmail}</a>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account details</strong>: your name, email address, and optionally job title and phone number. Passwords are handled by our authentication provider and are never stored by us in readable form.</li>
        <li><strong>Workspace content</strong> that you and your team add: clients and their contact details, projects, tasks, milestones, comments, files, invoices, payments you record, time entries, website delivery and maintenance details, and support tickets.</li>
        <li><strong>Usage and technical data</strong>: server logs (such as request times and error references) and privacy-friendly, cookieless page-view analytics. We do not use advertising trackers.</li>
        <li><strong>Cookies</strong>: only the ones needed to keep you signed in and remember which workspace you selected.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: sign you in, show your workspace, send notifications and invitations.</li>
        <li>To keep the service secure: access control, rate limiting, audit logs, and abuse prevention.</li>
        <li>To understand and improve the product using aggregated analytics.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We don’t sell personal information. We use these service providers to run AgencyOS:</p>
      <ul>
        <li><strong>Supabase</strong>: database, authentication and file storage.</li>
        <li><strong>Vercel</strong>: website hosting and cookieless analytics.</li>
        <li><strong>Resend</strong>: sending account and notification emails.</li>
      </ul>
      <p>
        Inside a workspace, information is visible to that agency’s team according to their role. Agency clients only see the projects, shared files,
        messages and invoices their agency shares with them in the client portal.
      </p>

      <h2>Agencies and their clients</h2>
      <p>
        When an agency uses AgencyOS to store information about its own clients, the agency decides what is stored and is responsible for it. We process that
        information on the agency’s behalf. Clients with questions about their data should contact the agency first.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is active. When you delete your account, your personal data is deleted. If you are the only team member of a
        workspace, the workspace and everything in it is deleted too. Backups held by our providers are overwritten on their normal schedule.
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>You can view and update your profile in Settings (or Profile in the client portal).</li>
        <li>You can delete your account at any time from those same pages.</li>
        <li>You can ask us for a copy of your data or for corrections by emailing {LEGAL.contactEmail}.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Each agency’s data is kept separate, every action is permission-checked on our servers, files are stored privately and shared only through short-lived links,
        and connections are encrypted (HTTPS).
      </p>

      <h2>Children</h2>
      <p>AgencyOS is a business tool and is not intended for anyone under 16.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above and, for significant changes, notify account owners by email.</p>

      <p className="pt-6 text-[13px]">
        See also our <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
