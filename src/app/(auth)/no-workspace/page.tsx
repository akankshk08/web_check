import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { CreateWorkspaceForm } from "@/components/auth/create-workspace-form";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function NoWorkspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AuthCard
      title="Create your agency workspace"
      description={`You’re signed in as ${user.email}, but you’re not part of a workspace yet. Create one to get started — or, if you were invited by an agency, open the invitation link from your email instead.`}
      footer={
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="link" size="sm">
            Sign out
          </Button>
        </form>
      }
    >
      <CreateWorkspaceForm />
    </AuthCard>
  );
}
