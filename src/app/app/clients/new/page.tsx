import type { Metadata } from "next";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shared/page";
import { Card, CardContent } from "@/components/ui/card";
import { requireManagerPage } from "@/server/auth/session";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireManagerPage();
  return (
    <div className="max-w-3xl">
      <PageHeader title="New client" breadcrumbs={[{ href: "/app/clients", label: "Clients" }]} />
      <Card>
        <CardContent className="py-5">
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
