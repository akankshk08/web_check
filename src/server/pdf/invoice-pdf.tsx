import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate } from "@/lib/dates";
import { formatMoney, subtractMoney } from "@/lib/money";
import type { getInvoice } from "@/server/services/invoices";

type Data = Awaited<ReturnType<typeof getInvoice>>;

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#172033", fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: "#697386" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  label: { fontSize: 8, color: "#697386", textTransform: "uppercase", marginBottom: 3 },
  block: { marginTop: 24 },
  th: { flexDirection: "row", borderBottom: "1 solid #E7EAF0", paddingBottom: 6, marginTop: 24, color: "#697386", fontSize: 8 },
  tr: { flexDirection: "row", borderBottom: "1 solid #F1F4F8", paddingVertical: 7 },
  cDesc: { flex: 1 },
  cQty: { width: 50, textAlign: "right" },
  cPrice: { width: 80, textAlign: "right" },
  cAmt: { width: 90, textAlign: "right" },
  totals: { marginTop: 12, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
});

export function InvoicePdf({ data }: { data: Data }) {
  const { invoice, client, org, items, project } = data;
  const money = (v: string) => formatMoney(v, invoice.currency);
  return (
    <Document title={`Invoice ${invoice.number}`} author={org.name}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.h1}>{org.name}</Text>
            {org.address ? <Text style={s.muted}>{org.address}</Text> : null}
            {org.email ? <Text style={s.muted}>{org.email}</Text> : null}
            {org.phone ? <Text style={s.muted}>{org.phone}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.h1, { color: "#536DFE" }]}>INVOICE</Text>
            <Text>{invoice.number}</Text>
            <Text style={s.muted}>Status: {invoice.status.replace("_", " ")}</Text>
          </View>
        </View>

        <View style={[s.row, s.block]}>
          <View>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.bold}>{client.companyName ?? client.name}</Text>
            <Text>{client.name}</Text>
            <Text style={s.muted}>{client.email}</Text>
            {client.address ? <Text style={s.muted}>{client.address}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>Issue date</Text>
            <Text>{formatDate(invoice.issueDate)}</Text>
            <Text style={[s.label, { marginTop: 8 }]}>Due date</Text>
            <Text>{formatDate(invoice.dueDate)}</Text>
            {project ? (
              <>
                <Text style={[s.label, { marginTop: 8 }]}>Project</Text>
                <Text>{project.name}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={s.th}>
          <Text style={s.cDesc}>DESCRIPTION</Text>
          <Text style={s.cQty}>QTY</Text>
          <Text style={s.cPrice}>UNIT PRICE</Text>
          <Text style={s.cAmt}>AMOUNT</Text>
        </View>
        {items.map((item) => (
          <View style={s.tr} key={item.id} wrap={false}>
            <Text style={s.cDesc}>{item.description}</Text>
            <Text style={s.cQty}>{Number(item.quantity).toString()}</Text>
            <Text style={s.cPrice}>{money(item.unitPrice)}</Text>
            <Text style={s.cAmt}>{money(item.amount)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.muted}>Subtotal</Text>
            <Text>{money(invoice.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>Tax ({Number(invoice.taxRate)}%)</Text>
            <Text>{money(invoice.taxAmount)}</Text>
          </View>
          <View style={[s.totalRow, { borderTop: "1 solid #E7EAF0", marginTop: 4, paddingTop: 6 }]}>
            <Text style={s.bold}>Total</Text>
            <Text style={s.bold}>{money(invoice.total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.muted}>Paid</Text>
            <Text>{money(invoice.amountPaid)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.bold}>Balance due</Text>
            <Text style={s.bold}>{money(subtractMoney(invoice.total, invoice.amountPaid))}</Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={s.block}>
            <Text style={s.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
