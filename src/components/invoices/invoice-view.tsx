import { DetailList } from "@/components/shared/page";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatMoney, subtractMoney } from "@/lib/money";
import { humanize } from "@/lib/utils";
import type { getInvoice } from "@/server/services/invoices";

type Data = Awaited<ReturnType<typeof getInvoice>>;

/** Invoice body shared by the agency app and the client portal. */
export function InvoiceView({ data }: { data: Data }) {
  const { invoice, client, org, items, payments, project } = data;
  const money = (v: string) => formatMoney(v, invoice.currency);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-6 py-5 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted">From</p>
            <p className="mt-1 text-sm font-semibold">{org.name}</p>
            {org.email && <p className="text-[13px] text-muted">{org.email}</p>}
            {org.address && <p className="text-[13px] whitespace-pre-wrap text-muted">{org.address}</p>}
          </div>
          <div>
            <p className="text-xs text-muted">Bill to</p>
            <p className="mt-1 text-sm font-semibold">{client.companyName ?? client.name}</p>
            <p className="text-[13px] text-muted">{client.name}</p>
            <p className="text-[13px] text-muted">{client.email}</p>
          </div>
          <div className="md:col-span-2">
            <DetailList
              items={[
                { label: "Issue date", value: formatDate(invoice.issueDate) },
                { label: "Due date", value: formatDate(invoice.dueDate) },
                { label: "Project", value: project?.name ?? "—" },
                { label: "Currency", value: invoice.currency },
              ]}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Description</TH>
              <TH className="text-right">Qty</TH>
              <TH className="text-right">Unit price</TH>
              <TH className="text-right">Amount</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((i) => (
              <TR key={i.id}>
                <TD>{i.description}</TD>
                <TD className="text-right tabular-nums">{Number(i.quantity)}</TD>
                <TD className="text-right tabular-nums">{money(i.unitPrice)}</TD>
                <TD className="text-right tabular-nums">{money(i.amount)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <dl className="ml-auto w-full max-w-xs border-t border-border px-5 py-4 text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted">Tax ({Number(invoice.taxRate)}%)</dt>
            <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(invoice.total)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted">Paid</dt>
            <dd className="tabular-nums">{money(invoice.amountPaid)}</dd>
          </div>
          <div className="flex justify-between py-1 font-semibold">
            <dt>Balance due</dt>
            <dd className="tabular-nums">{money(subtractMoney(invoice.total, invoice.amountPaid))}</dd>
          </div>
        </dl>
      </Card>
      {invoice.notes && (
        <Card>
          <CardContent>
            <p className="text-xs text-muted">Notes</p>
            <p className="mt-1 text-[13px] whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
      {payments.length > 0 && (
        <Card>
          <CardContent>
            <p className="mb-3 text-sm font-semibold">Payments</p>
            <ul className="divide-y divide-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-4 py-2 text-[13px]">
                  <span className="w-28 text-muted">{formatDate(p.paidOn)}</span>
                  <span className="flex-1">
                    {humanize(p.method)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="font-medium tabular-nums">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
