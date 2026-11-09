import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireFinancePage } from "@/server/auth/session";
import { listClientOptions } from "@/server/services/clients";
import { getOrganization } from "@/server/services/organizations";
import { listProjectOptions } from "@/server/services/projects";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const ctx = await requireFinancePage();
  const db = getDb();
  const [clients, projects, org] = await Promise.all([listClientOptions(db, ctx), listProjectOptions(db, ctx), getOrganization(db, ctx)]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="New invoice" description={`The next number is assigned automatically (${org.invoicePrefix}-…).`} breadcrumbs={[{ href: "/app/invoices", label: "Invoices" }]} />
      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title="Add a client first"
            action={
              <Button asChild size="sm">
                <Link href="/app/clients/new">Add client</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <InvoiceForm clients={clients} projects={projects} currency={org.currency} defaultTaxRate={org.defaultTaxRate} />
      )}
    </div>
  );
}
