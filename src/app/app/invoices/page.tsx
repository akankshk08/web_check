import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { FilterBar } from "@/components/shared/filters";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { invoiceStatusEnum } from "@/db/schema/enums";
import { formatDate } from "@/lib/dates";
import { formatMoney, subtractMoney } from "@/lib/money";
import { requireFinancePage } from "@/server/auth/session";
import { pageNumber, pickEnum, sp } from "@/server/page";
import { listInvoices } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireFinancePage();
  const params = await searchParams;
  const q = sp(params.q) ?? "";
  const status = pickEnum(sp(params.status), invoiceStatusEnum.enumValues);
  const page = pageNumber(sp(params.page));
  const data = await listInvoices(getDb(), ctx, { q, status, page });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Create invoices, track payments and download PDFs."
        actions={
          <Button asChild>
            <Link href="/app/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        }
      />
      <Card>
        <div className="border-b border-border p-3">
          <FilterBar searchPlaceholder="Search number or client" filters={[{ name: "status", label: "All statuses", options: [...invoiceStatusEnum.enumValues] }]} />
        </div>
        {data.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={q || status ? "No invoices match your filters" : "No invoices yet"}
            action={
              !q && !status ? (
                <Button asChild size="sm">
                  <Link href="/app/invoices/new">Create invoice</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Number</TH>
                <TH>Client</TH>
                <TH>Status</TH>
                <TH>Issued</TH>
                <TH>Due</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Balance</TH>
              </tr>
            </THead>
            <TBody>
              {data.rows.map((i) => (
                <TR key={i.id}>
                  <TD>
                    <Link href={`/app/invoices/${i.id}`} className="font-medium hover:underline">
                      {i.number}
                    </Link>
                  </TD>
                  <TD className="text-muted">{i.clientName}</TD>
                  <TD>
                    <StatusBadge status={i.status} />
                  </TD>
                  <TD className="text-muted">{formatDate(i.issueDate)}</TD>
                  <TD className={i.status === "OVERDUE" ? "text-danger" : "text-muted"}>{formatDate(i.dueDate)}</TD>
                  <TD className="text-right tabular-nums">{formatMoney(i.total, i.currency)}</TD>
                  <TD className="text-right tabular-nums">{i.status === "CANCELLED" ? "—" : formatMoney(subtractMoney(i.total, i.amountPaid), i.currency)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/app/invoices" params={{ q, status }} />
      </Card>
    </>
  );
}
