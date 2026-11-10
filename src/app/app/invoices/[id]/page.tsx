import type { Metadata } from "next";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { InvoiceStatusButtons, RecordPaymentButton } from "@/components/invoices/invoice-actions";
import { InvoiceView } from "@/components/invoices/invoice-view";
import { PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { compareMoney, subtractMoney } from "@/lib/money";
import { requireFinancePage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { getInvoice } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireFinancePage();
  const { id } = await params;
  const data = await orNotFound(getInvoice(getDb(), ctx, id));
  const { invoice } = data;
  const balance = subtractMoney(invoice.total, invoice.amountPaid);
  const payable = ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && compareMoney(balance, "0") > 0;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={<StatusBadge status={invoice.status} />}
        breadcrumbs={[{ href: "/app/invoices", label: "Invoices" }]}
        actions={
          <>
            <InvoiceStatusButtons id={invoice.id} status={invoice.status} hasPayments={data.payments.length > 0} />
            {invoice.status === "DRAFT" && (
              <Button asChild variant="secondary">
                <Link href={`/app/invoices/${invoice.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <a href={`/api/invoices/${invoice.id}/pdf`}>
                <Download /> PDF
              </a>
            </Button>
            {payable && <RecordPaymentButton invoiceId={invoice.id} balance={balance} />}
          </>
        }
      />
      <InvoiceView data={data} />
    </div>
  );
}
