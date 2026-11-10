import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { OrganizationForm, ProfileForm, TransferOwnershipForm } from "@/components/settings/settings-forms";
import { AccountCards } from "@/components/settings/account-cards";
import { PageHeader } from "@/components/shared/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isManager, isOwner } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { getOrganization } from "@/server/services/organizations";
import { listTeam } from "@/server/services/team";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireStaffPage();
  const db = getDb();
  const [[me], org, team] = await Promise.all([
    db.select().from(users).where(eq(users.id, ctx.userId)).limit(1),
    getOrganization(db, ctx),
    isOwner(ctx) ? listTeam(db, ctx) : Promise.resolve([]),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" />
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm email={ctx.email} initial={{ fullName: me?.fullName ?? ctx.fullName, jobTitle: me?.jobTitle ?? "", phone: me?.phone ?? "" }} />
        </CardContent>
      </Card>
      {isManager(ctx) && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Details used across the workspace and on invoices.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <OrganizationForm
              initial={{
                name: org.name,
                email: org.email ?? "",
                phone: org.phone ?? "",
                website: org.website ?? "",
                address: org.address ?? "",
                currency: org.currency,
                defaultTaxRate: Number(org.defaultTaxRate).toString(),
                invoicePrefix: org.invoicePrefix,
              }}
            />
          </CardContent>
        </Card>
      )}
      <AccountCards isOwner={isOwner(ctx)} />
      {isOwner(ctx) && (
        <Card className="border-danger/30">
          <CardHeader>
            <div>
              <CardTitle>Transfer ownership</CardTitle>
              <CardDescription>The new owner gets full control. You’ll become an admin with finance access.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TransferOwnershipForm members={team.filter((m) => m.userId !== ctx.userId)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
