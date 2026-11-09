import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAuth } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { InvoicePdf } from "@/server/pdf/invoice-pdf";
import { routeError } from "@/server/route";
import { getInvoice } from "@/server/services/invoices";

export const runtime = "nodejs";

/** PDF for finance staff, or for the client the (non-draft) invoice belongs to. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new NotFoundError("Invoice not found.");
    const ctx = await requireAuth();
    const data = await getInvoice(getDb(), ctx, id);
    const buffer = await renderToBuffer(<InvoicePdf data={data} />);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${data.invoice.number.replace(/[^\w-]/g, "")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return routeError(err);
  }
}
