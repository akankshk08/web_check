"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  deliverySchema,
  invoiceSchema,
  invoiceStatusSchema,
  maintenanceSchema,
  paymentSchema,
  ticketSchema,
  ticketUpdateSchema,
  updateMaintenanceSchema,
} from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { createInvoice, deleteDraftInvoice, recordPayment, setInvoiceStatus, updateInvoice } from "@/server/services/invoices";
import { createMaintenanceRecord, deleteMaintenanceRecord, updateMaintenanceRecord, upsertDelivery } from "@/server/services/maintenance";
import { markNotificationsRead } from "@/server/services/notifications";
import { createTicket, updateTicket } from "@/server/services/support";

const idSchema = z.object({ id: z.uuid() }).strict();

// ---------- Invoices ----------
export const createInvoiceAction = authedAction(invoiceSchema, async (input, ctx) => {
  const inv = await createInvoice(getDb(), ctx, input);
  revalidatePath("/app/invoices");
  return { id: inv.id };
});
export const updateInvoiceAction = authedAction(z.object({ id: z.uuid(), invoice: invoiceSchema }).strict(), async (input, ctx) => {
  await updateInvoice(getDb(), ctx, input.id, input.invoice);
  revalidatePath("/app/invoices", "layout");
  return { id: input.id };
});
export const setInvoiceStatusAction = authedAction(invoiceStatusSchema, async (input, ctx) => {
  await setInvoiceStatus(getDb(), ctx, input.id, input.status);
  revalidatePath("/app/invoices", "layout");
  return null;
});
export const recordPaymentAction = authedAction(paymentSchema, async (input, ctx) => {
  await recordPayment(getDb(), ctx, input);
  revalidatePath("/app/invoices", "layout");
  return null;
});
export const deleteInvoiceAction = authedAction(idSchema, async (input, ctx) => {
  await deleteDraftInvoice(getDb(), ctx, input.id);
  revalidatePath("/app/invoices", "layout");
  return null;
});

// ---------- Delivery & maintenance ----------
export const upsertDeliveryAction = authedAction(deliverySchema, async (input, ctx) => {
  await upsertDelivery(getDb(), ctx, input);
  revalidatePath("/app/maintenance", "layout");
  return null;
});
export const createMaintenanceAction = authedAction(maintenanceSchema, async (input, ctx) => {
  await createMaintenanceRecord(getDb(), ctx, input);
  revalidatePath("/app/maintenance", "layout");
  return null;
});
export const updateMaintenanceAction = authedAction(updateMaintenanceSchema, async ({ id, ...input }, ctx) => {
  await updateMaintenanceRecord(getDb(), ctx, id, input);
  revalidatePath("/app/maintenance", "layout");
  return null;
});
export const deleteMaintenanceAction = authedAction(idSchema, async (input, ctx) => {
  await deleteMaintenanceRecord(getDb(), ctx, input.id);
  revalidatePath("/app/maintenance", "layout");
  return null;
});

// ---------- Support ----------
export const createTicketAction = authedAction(ticketSchema, async (input, ctx) => {
  const db = getDb();
  await enforceRateLimit(db, `ticket:${ctx.userId}`, RATE_LIMITS.ticket.limit, RATE_LIMITS.ticket.window);
  await createTicket(db, ctx, input);
  revalidatePath("/portal/support");
  return null;
});
export const updateTicketAction = authedAction(ticketUpdateSchema, async (input, ctx) => {
  await updateTicket(getDb(), ctx, input);
  revalidatePath("/app/clients", "layout");
  revalidatePath("/app/support");
  return null;
});

// ---------- Notifications ----------
export const markNotificationsReadAction = authedAction(
  z.object({ ids: z.union([z.array(z.uuid()).max(100), z.literal("all")]) }).strict(),
  async (input, ctx) => {
    await markNotificationsRead(getDb(), ctx, input.ids);
    revalidatePath("/", "layout");
    return null;
  },
);
