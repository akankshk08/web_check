import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireManagerPage } from "@/server/auth/session";
import { sp } from "@/server/page";
import { listClientOptions } from "@/server/services/clients";
import { listStaffOptions } from "@/server/services/team";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireManagerPage();
  const db = getDb();
  const [clients, staff] = await Promise.all([listClientOptions(db, ctx), listStaffOptions(db, ctx)]);
  const clientId = sp((await searchParams).clientId);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New project" breadcrumbs={[{ href: "/app/projects", label: "Projects" }]} />
      <Card>
        <CardContent className="py-5">
          {clients.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Add a client first"
              description="Every project belongs to a client."
              action={
                <Button asChild size="sm">
                  <Link href="/app/clients/new">Add client</Link>
                </Button>
              }
            />
          ) : (
            <ProjectForm clients={clients} staff={staff} defaultClientId={clients.some((c) => c.id === clientId) ? clientId : undefined} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
