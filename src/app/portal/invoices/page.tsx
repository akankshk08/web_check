import type { Metadata } from "next";
import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { z } from "zod";
import { InvoiceView } from "@/components/invoices/invoice-view";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { formatMoney, subtractMoney } from "@/lib/money";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound, sp } from "@/server/page";
import { getInvoice, listClientInvoices } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Invoices" };

export default async function PortalInvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireClientPage();
  const db = getDb();
  const selected = sp((await searchParams).invoice);

  if (selected && z.uuid().safeParse(selected).success) {
    const data = await orNotFound(getInvoice(db, ctx, selected));
    return (
      <div className="max-w-4xl">
        <PageHeader
          title={`Invoice ${data.invoice.number}`}
          description={<StatusBadge status={data.invoice.status} />}
          breadcrumbs={[{ href: "/portal/invoices", label: "Invoices" }]}
          actions={
            <Button asChild variant="secondary">
              <a href={`/api/invoices/${data.invoice.id}/pdf`}>
                <Download /> Download PDF
              </a>
            </Button>
          }
        />
        <InvoiceView data={data} />
      </div>
    );
  }

  const invoices = await listClientInvoices(db, ctx);
  return (
    <>
      <PageHeader title="Invoices" description="Payments are handled directly with your agency." />
      <Card>
        {invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Status</TH>
                <TH>Issued</TH>
                <TH>Due</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Balance</TH>
                <TH className="w-10">
                  <span className="sr-only">Download</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {invoices.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/portal/invoices?invoice=${i.id}`} className="font-medium hover:underline">
                      {i.number}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge status={i.status} />
                  </TD>
                  <TD className="text-muted">{formatDate(i.issueDate)}</TD>
                  <TD className={i.status === "OVERDUE" ? "text-danger" : "text-muted"}>{formatDate(i.dueDate)}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(i.total, i.currency)}</TD>
                  <TD className="text-right tabular-nums">{i.status === "CANCELLED" ? "—" : formatMoney(subtractMoney(i.total, i.amountPaid), i.currency)}</TD>
                  <TD>
                    <a href={`/api/invoices/${i.id}/pdf`} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground" aria-label={`Download ${i.number}`}>
                      <Download className="size-4" />
                    </a>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
