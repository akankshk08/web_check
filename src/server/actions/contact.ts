"use server";
import { z } from "zod";
import { getDb } from "@/db";
import { email, requiredText } from "@/lib/validations/common";
import { publicAction } from "@/server/action";
import { escapeHtml, sendEmail } from "@/server/email";
import { BadRequestError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";

const contactSchema = z
  .object({ name: requiredText("Name", 120), email, company: z.string().trim().max(160), message: requiredText("Message", 4000) })
  .strict();

export const sendContactMessageAction = publicAction(contactSchema, async (input) => {
  await enforceRateLimit(getDb(), `contact:${await clientIp()}`, 5, 60 * 60);
  const to = process.env.CONTACT_EMAIL;
  if (!to || !process.env.RESEND_API_KEY) {
    throw new BadRequestError("The contact form isn't configured on this deployment yet. Please try again later.");
  }
  const sent = await sendEmail({
    to,
    subject: `AgencyOS contact: ${input.name}`,
    html: `<p><strong>${escapeHtml(input.name)}</strong> (${escapeHtml(input.email)})${input.company ? `, ${escapeHtml(input.company)}` : ""}</p><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`,
  });
  if (!sent) throw new BadRequestError("We couldn't send your message right now. Please try again later.");
  return null;
});
