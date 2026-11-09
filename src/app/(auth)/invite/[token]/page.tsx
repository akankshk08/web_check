import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AcceptInviteButton, InviteSignupForm } from "@/components/auth/invite-forms";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { getSessionUser } from "@/server/auth/session";
import { getInvitationByToken } from "@/server/services/invitations";

export const metadata: Metadata = { title: "Invitation" };

const MESSAGES = {
  expired: "This invitation has expired. Ask the person who invited you to send a new one.",
  accepted: "This invitation has already been used. Sign in to continue.",
  revoked: "This invitation was cancelled by the agency.",
} as const;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = token.length >= 20 && token.length <= 200 ? await getInvitationByToken(getDb(), token) : null;

  if (!invitation) {
    return <AuthCard title="Invitation not found" description="This link is invalid. Check that you copied the full link from your email." />;
  }
  if (invitation.state !== "valid") {
    return (
      <AuthCard title="Invitation unavailable" description={MESSAGES[invitation.state]}>
        <Button asChild variant="secondary">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  const roleLabel = invitation.role === "CLIENT" ? "the client portal" : `the team as ${invitation.role === "ADMIN" ? "an admin" : "a team member"}`;
  const user = await getSessionUser();
  const title = `Join ${invitation.orgName}`;
  const description = `You’ve been invited to ${roleLabel} on AgencyOS.`;

  if (user) {
    if (user.email?.toLowerCase() === invitation.email) {
      return (
        <AuthCard title={title} description={description}>
          <AcceptInviteButton token={token} />
        </AuthCard>
      );
    }
    return (
      <AuthCard title={title} description={`This invitation is for ${invitation.email}, but you’re signed in as ${user.email}.`}>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary">
            Sign out and switch account
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={title}
      description={description}
      footer={
        <>
          Already have an AgencyOS account?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-medium text-primary hover:underline">
            Sign in to accept
          </Link>
        </>
      }
    >
      <InviteSignupForm token={token} email={invitation.email} />
    </AuthCard>
  );
}
