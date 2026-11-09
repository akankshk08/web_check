import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ProfileForm } from "@/components/settings/settings-forms";
import { PageHeader } from "@/components/shared/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireClientPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function PortalProfilePage() {
  const ctx = await requireClientPage();
  const [me] = await getDb().select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile" />
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm email={ctx.email} initial={{ fullName: me?.fullName ?? ctx.fullName, jobTitle: me?.jobTitle ?? "", phone: me?.phone ?? "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
