import { describe, expect, it } from "vitest";
import { validateFileMeta, sanitizeFileName } from "@/lib/files";
import { safeExternalUrl, safeNextPath } from "@/lib/utils";
import { registerSchema } from "@/lib/validations/auth";
import { clientSchema, invoiceSchema, taskStatusSchema } from "@/lib/validations/entities";
import { canManageFinance, homePathFor, isManager, isStaff } from "@/server/auth/permissions";
import { invitationState } from "@/server/services/invitations";
import { effectiveInvoiceStatus } from "@/server/services/invoices";

describe("validation", () => {
  it("rejects unexpected fields (mass assignment) such as role or organizationId", () => {
    const ok = { fullName: "Ana", agencyName: "Studio", email: "ANA@Example.com", password: "longpassword" };
    expect(registerSchema.parse(ok).email).toBe("ana@example.com");
    expect(registerSchema.safeParse({ ...ok, role: "OWNER" }).success).toBe(false);
    expect(
      clientSchema.safeParse({ name: "a", email: "a@b.co", companyName: "", phone: "", address: "", notes: "", status: "ACTIVE", organizationId: "x" }).success,
    ).toBe(false);
  });

  it("validates invoice dates, items and decimals", () => {
    const base = { clientId: crypto.randomUUID(), projectId: "", issueDate: "2026-01-10", dueDate: "2026-01-01", taxRate: "10", notes: "", items: [{ description: "x", quantity: "1", unitPrice: "5" }] };
    expect(invoiceSchema.safeParse(base).success).toBe(false); // due before issue
    expect(invoiceSchema.safeParse({ ...base, dueDate: "2026-02-01", items: [] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...base, dueDate: "2026-02-01", items: [{ description: "x", quantity: "0", unitPrice: "5" }] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...base, dueDate: "2026-02-01", items: [{ description: "x", quantity: "1", unitPrice: "5.555" }] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...base, dueDate: "2026-02-01" }).success).toBe(true);
  });

  it("rejects unknown task statuses", () => {
    expect(taskStatusSchema.safeParse({ id: crypto.randomUUID(), status: "DONE" }).success).toBe(false);
  });
});

describe("permissions", () => {
  it("maps roles to capabilities", () => {
    expect(isStaff({ role: "EMPLOYEE" })).toBe(true);
    expect(isStaff({ role: "CLIENT" })).toBe(false);
    expect(isManager({ role: "EMPLOYEE" })).toBe(false);
    expect(canManageFinance({ role: "OWNER", canManageFinances: false })).toBe(true);
    expect(canManageFinance({ role: "ADMIN", canManageFinances: false })).toBe(false);
    expect(canManageFinance({ role: "ADMIN", canManageFinances: true })).toBe(true);
    expect(canManageFinance({ role: "EMPLOYEE", canManageFinances: true })).toBe(false);
    expect(homePathFor("CLIENT")).toBe("/portal");
  });
});

describe("invitation and invoice state", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("computes invitation state", () => {
    const future = new Date("2026-06-05");
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("valid");
    expect(invitationState({ acceptedAt: now, revokedAt: null, expiresAt: future }, now)).toBe("accepted");
    expect(invitationState({ acceptedAt: null, revokedAt: now, expiresAt: future }, now)).toBe("revoked");
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: new Date("2026-05-31") }, now)).toBe("expired");
  });
  it("shows unpaid past-due invoices as overdue", () => {
    expect(effectiveInvoiceStatus({ status: "SENT", dueDate: "2026-05-01" }, "2026-06-01")).toBe("OVERDUE");
    expect(effectiveInvoiceStatus({ status: "PAID", dueDate: "2026-05-01" }, "2026-06-01")).toBe("PAID");
    expect(effectiveInvoiceStatus({ status: "DRAFT", dueDate: "2026-05-01" }, "2026-06-01")).toBe("DRAFT");
  });
});

describe("safety helpers", () => {
  it("only allows same-site redirects", () => {
    expect(safeNextPath("/app/projects")).toBe("/app/projects");
    expect(safeNextPath("https://evil.com")).toBe("/app");
    expect(safeNextPath("//evil.com")).toBe("/app");
    expect(safeNextPath("/\\evil.com")).toBe("/app");
  });
  it("only renders http(s) links", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("https://site.com")).toBe("https://site.com/");
  });
  it("validates uploads", () => {
    expect(validateFileMeta("a.pdf", "application/pdf", 100)).toBeNull();
    expect(validateFileMeta("a.exe", "application/pdf", 100)).not.toBeNull();
    expect(validateFileMeta("a.svg", "image/svg+xml", 100)).not.toBeNull();
    expect(sanitizeFileName("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFileName("My Design (v2).pdf")).toBe("My-Design-v2.pdf");
  });
});
