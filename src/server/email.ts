import { Resend } from "resend";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function appUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Simple branded HTML email. All dynamic values are escaped. */
export function renderEmail({ heading, body, ctaLabel, ctaPath }: { heading: string; body: string; ctaLabel?: string; ctaPath?: string }) {
  const cta =
    ctaLabel && ctaPath
      ? `<p style="margin:24px 0"><a href="${escapeHtml(appUrl(ctaPath))}" style="background:#536DFE;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(ctaLabel)}</a></p>`
      : "";
  return `<div style="font-family:Inter,Arial,sans-serif;color:#172033;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-weight:700;font-size:16px;margin:0 0 24px">AgencyOS</p>
  <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h1>
  <p style="color:#697386;line-height:1.6;margin:0">${escapeHtml(body)}</p>${cta}
  <p style="color:#697386;font-size:12px;margin-top:32px">You received this because of activity in your AgencyOS workspace.</p></div>`;
}

/**
 * Sends a transactional email via Resend. Never throws: email problems must not break
 * the user's action. Without RESEND_API_KEY the email is skipped and logged.
 */
export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "test") console.info(`[email skipped: RESEND_API_KEY not set] "${input.subject}"`);
    return false;
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "AgencyOS <notifications@example.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      console.error("[email] send failed:", error.name);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message);
    return false;
  }
}
