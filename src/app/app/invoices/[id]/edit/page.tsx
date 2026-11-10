import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/shared/page";
import { getDb } from "@/db";
import { requireFinancePage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listClientOptions } from "@/server/services/clients";
import { getInvoice } from "@/server/services/invoices";
import { listProjectOptions } from "@/server/services/projects";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireFinancePage();
  const { id } = await params;
  const db = getDb();
  const data = await orNotFound(getInvoice(db, ctx, id));
  if (data.invoice.status !== "DRAFT") redirect(`/app/invoices/${id}`);
  const [clients, projects] = await Promise.all([listClientOptions(db, ctx), listProjectOptions(db, ctx)]);
  const { invoice, items } = data;
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Edit ${invoice.number}`} breadcrumbs={[{ href: "/app/invoices", label: "Invoices" }, { href: `/app/invoices/${id}`, label: invoice.number }]} />
      <InvoiceForm
        invoiceId={invoice.id}
        clients={clients}
        projects={projects}
        currency={invoice.currency}
        defaultTaxRate={invoice.taxRate}
        initial={{
          clientId: invoice.clientId,
          projectId: invoice.projectId ?? "",
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          taxRate: Number(invoice.taxRate).toString(),
          notes: invoice.notes ?? "",
          items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity).toString(), unitPrice: i.unitPrice })),
        }}
      />
    </div>
  );
}
