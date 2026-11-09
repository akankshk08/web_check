import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No workspace" };

export default function NoWorkspacePage() {
  return (
    <AuthCard title="You’re not part of a workspace" description="Your account isn’t an active member of any agency. Ask an agency owner or admin to invite you, then open the invitation link.">
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </AuthCard>
  );
}
