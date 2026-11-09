import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { invitations, notifications, organizationMembers } from "@/db/schema";
import { BadRequestError, ForbiddenError, NotFoundError, RateLimitError } from "@/server/errors";
import { completeUpload, deleteAttachment, getDownloadUrl, requestUpload } from "@/server/services/files";
import { acceptInvitation, createInvitation, revokeInvitation } from "@/server/services/invitations";
import { createInvoice, getInvoice, listClientInvoices, recordPayment, setInvoiceStatus } from "@/server/services/invoices";
import { notify } from "@/server/services/notifications";
import { enforceRateLimit } from "@/server/rate-limit";
import { createUser, ctxFor, db, resetDatabase } from "../helpers/db";
import { buildAgency, FakeStorage } from "../helpers/fixtures";

let A: Awaited<ReturnType<typeof buildAgency>>;
let B: Awaited<ReturnType<typeof buildAgency>>;
const storage = new FakeStorage();

beforeAll(async () => {
  await resetDatabase();
  A = await buildAgency("Epsilon");
  B = await buildAgency("Zeta");
});

async function upload(ctx = A.ownerCtx, opts: { share?: boolean; projectId?: string } = {}) {
  const req = await requestUpload(db, storage, ctx, {
    projectId: opts.projectId ?? A.projectA.id,
    taskId: "",
    milestoneId: "",
    fileName: "design.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    shareWithClient: opts.share ?? false,
    isDeliverable: false,
  });
  storage.objects.set(req.path, 2048);
  await completeUpload(db, storage, ctx, req.attachmentId);
  return req.attachmentId;
}

describe("5. Unauthorized file access is rejected", () => {
  it("authorized staff and the owning client get a short-lived signed URL", async () => {
    const shared = await upload(A.ownerCtx, { share: true });
    await expect(getDownloadUrl(db, storage, A.ownerCtx, shared)).resolves.toMatch(/expires=60/);
    await expect(getDownloadUrl(db, storage, A.employeeCtx, shared)).resolves.toBeTruthy();
    await expect(getDownloadUrl(db, storage, A.clientACtx, shared)).resolves.toBeTruthy();
  });

  it("rejects other agencies, unassigned employees, other clients and internal files", async () => {
    const internal = await upload(A.ownerCtx, { share: false });
    const shared = await upload(A.ownerCtx, { share: true });
    await expect(getDownloadUrl(db, storage, B.ownerCtx, shared)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDownloadUrl(db, storage, A.outsiderCtx, shared)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDownloadUrl(db, storage, A.clientBCtx, shared)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDownloadUrl(db, storage, A.clientACtx, internal)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates type, size, project access and the stored object", async () => {
    const base = { projectId: A.projectA.id, taskId: "", milestoneId: "", shareWithClient: false, isDeliverable: false };
    await expect(requestUpload(db, storage, A.ownerCtx, { ...base, fileName: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 10 })).rejects.toBeInstanceOf(BadRequestError);
    await expect(requestUpload(db, storage, A.ownerCtx, { ...base, fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 26 * 1024 * 1024 })).rejects.toBeInstanceOf(BadRequestError);
    await expect(requestUpload(db, storage, A.outsiderCtx, { ...base, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(requestUpload(db, storage, A.employeeCtx, { ...base, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10, shareWithClient: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requestUpload(db, storage, A.clientACtx, { ...base, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 })).rejects.toBeInstanceOf(ForbiddenError);
    // declared size must match the uploaded object
    const req = await requestUpload(db, storage, A.ownerCtx, { ...base, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 });
    storage.objects.set(req.path, 99999);
    await expect(completeUpload(db, storage, A.ownerCtx, req.attachmentId)).rejects.toBeInstanceOf(BadRequestError);
    // a pending (unfinished) upload can't be downloaded
    const pending = await requestUpload(db, storage, A.ownerCtx, { ...base, fileName: "b.pdf", mimeType: "application/pdf", sizeBytes: 10 });
    await expect(getDownloadUrl(db, storage, A.ownerCtx, pending.attachmentId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("employees can only delete their own uploads", async () => {
    const ownerFile = await upload(A.ownerCtx);
    await expect(deleteAttachment(db, storage, A.employeeCtx, ownerFile)).rejects.toBeInstanceOf(ForbiddenError);
    const mine = await upload(A.employeeCtx);
    await deleteAttachment(db, storage, A.employeeCtx, mine);
    await expect(getDownloadUrl(db, storage, A.ownerCtx, mine)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("8. Invoices calculate totals correctly", () => {
  const invoiceInput = () => ({
    clientId: A.clientA.id,
    projectId: A.projectA.id,
    issueDate: "2026-11-01",
    dueDate: "2026-11-30",
    taxRate: "18",
    notes: "",
    items: [
      { description: "Design", quantity: "3", unitPrice: "333.33" },
      { description: "Hosting", quantity: "1.5", unitPrice: "19.99" },
    ],
  });

  it("stores exact decimal totals and org-scoped sequential numbers", async () => {
    const inv = await createInvoice(db, A.ownerCtx, invoiceInput());
    // 3 x 333.33 = 999.99 ; 1.5 x 19.99 = 29.985 -> 29.99 ; subtotal 1029.98 ; tax 18% = 185.3964 -> 185.40
    expect(inv.subtotal).toBe("1029.98");
    expect(inv.taxAmount).toBe("185.40");
    expect(inv.total).toBe("1215.38");
    expect(inv.number).toBe("INV-0001");
    const second = await createInvoice(db, A.ownerCtx, invoiceInput());
    expect(second.number).toBe("INV-0002");
    const other = await createInvoice(db, B.ownerCtx, { ...invoiceInput(), clientId: B.clientA.id, projectId: B.projectA.id });
    expect(other.number).toBe("INV-0001"); // numbering is per organization
  });

  it("rejects a project that belongs to a different client", async () => {
    await expect(createInvoice(db, A.ownerCtx, { ...invoiceInput(), projectId: A.projectB.id })).rejects.toThrow(/selected client/);
  });

  it("records partial and full payments and never overpays", async () => {
    const inv = await createInvoice(db, A.ownerCtx, invoiceInput());
    await expect(recordPayment(db, A.ownerCtx, { invoiceId: inv.id, amount: "10.00", paidOn: "2026-11-05", method: "CARD", reference: "", notes: "" })).rejects.toThrow(/sent invoices/);
    await setInvoiceStatus(db, A.ownerCtx, inv.id, "SENT");
    const p1 = await recordPayment(db, A.ownerCtx, { invoiceId: inv.id, amount: "215.38", paidOn: "2026-11-05", method: "CARD", reference: "", notes: "" });
    expect(p1).toEqual({ amountPaid: "215.38", status: "PARTIALLY_PAID" });
    await expect(recordPayment(db, A.ownerCtx, { invoiceId: inv.id, amount: "1000.01", paidOn: "2026-11-06", method: "CARD", reference: "", notes: "" })).rejects.toThrow(/exceeds/);
    const p2 = await recordPayment(db, A.ownerCtx, { invoiceId: inv.id, amount: "1000.00", paidOn: "2026-11-06", method: "BANK_TRANSFER", reference: "", notes: "" });
    expect(p2).toEqual({ amountPaid: "1215.38", status: "PAID" });
  });

  it("clients see only their own non-draft invoices", async () => {
    const draft = await createInvoice(db, A.ownerCtx, invoiceInput());
    const visible = await listClientInvoices(db, A.clientACtx);
    expect(visible.map((i) => i.id)).not.toContain(draft.id);
    await expect(getInvoice(db, A.clientACtx, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await setInvoiceStatus(db, A.ownerCtx, draft.id, "SENT");
    await expect(getInvoice(db, A.clientACtx, draft.id)).resolves.toBeTruthy();
    await expect(getInvoice(db, A.clientBCtx, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    const own = await getInvoice(db, A.clientACtx, draft.id);
    expect(own.client.notes).toBeNull(); // internal client notes are never sent to the portal
  });
});

describe("9. Invitations cannot be reused after acceptance or expiry", () => {
  it("accepts once, then rejects reuse", async () => {
    const invitee = await createUser("New Hire", "new.hire@example.test");
    const { token } = await createInvitation(db, A.ownerCtx, { email: invitee.email, role: "EMPLOYEE" });
    const res = await acceptInvitation(db, { token, userId: invitee.id, email: invitee.email });
    expect(res).toEqual({ orgId: A.org.id, role: "EMPLOYEE" });
    const ctx = await ctxFor(invitee.id);
    expect(ctx.role).toBe("EMPLOYEE");
    await expect(acceptInvitation(db, { token, userId: invitee.id, email: invitee.email })).rejects.toThrow(/already been used/);
  });

  it("rejects expired, revoked and wrong-email invitations; stores only a hash", async () => {
    const person = await createUser("Late Person", "late@example.test");
    const expired = await createInvitation(db, A.ownerCtx, { email: person.email, role: "EMPLOYEE" });
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, expired.invitation.id));
    await expect(acceptInvitation(db, { token: expired.token, userId: person.id, email: person.email })).rejects.toThrow(/expired/);

    const revoked = await createInvitation(db, A.ownerCtx, { email: person.email, role: "EMPLOYEE" });
    await revokeInvitation(db, A.ownerCtx, revoked.invitation.id);
    await expect(acceptInvitation(db, { token: revoked.token, userId: person.id, email: person.email })).rejects.toThrow(/cancelled/);

    const fresh = await createInvitation(db, A.ownerCtx, { email: person.email, role: "EMPLOYEE" });
    const intruder = await createUser("Intruder", "intruder@example.test");
    await expect(acceptInvitation(db, { token: fresh.token, userId: intruder.id, email: intruder.email })).rejects.toBeInstanceOf(ForbiddenError);
    expect(fresh.invitation.tokenHash).not.toBe(fresh.token);

    const members = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, intruder.id));
    expect(members).toHaveLength(0);
  });

  it("a client invitation links the user to that client account only", async () => {
    const person = await createUser("Client Person", "client.person@example.test");
    const { token } = await createInvitation(db, A.ownerCtx, { email: person.email, role: "CLIENT", clientId: A.clientB.id });
    await acceptInvitation(db, { token, userId: person.id, email: person.email });
    const ctx = await ctxFor(person.id);
    expect(ctx.role).toBe("CLIENT");
    expect(ctx.clientIds).toEqual([A.clientB.id]);
  });

  it("cannot invite into another agency's client", async () => {
    await expect(createInvitation(db, A.ownerCtx, { email: "x@example.test", role: "CLIENT", clientId: B.clientA.id })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Notifications and rate limiting", () => {
  it("never creates duplicate notifications for the same event", async () => {
    const input = { orgId: A.org.id, userIds: [A.employee.user.id], type: "t", title: "Hello", dedupeKey: "same-event" };
    expect(await notify(db, input)).toHaveLength(1);
    expect(await notify(db, input)).toHaveLength(0);
    const rows = await db.select().from(notifications).where(eq(notifications.dedupeKey, "same-event"));
    expect(rows).toHaveLength(1);
  });

  it("blocks requests over the limit (429)", async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) await enforceRateLimit(db, key, 3, 60);
    await expect(enforceRateLimit(db, key, 3, 60)).rejects.toBeInstanceOf(RateLimitError);
  });
});
