import { describe, expect, it } from "vitest";
import { addMoney, calculateInvoiceTotals, compareMoney, fromHundredths, subtractMoney, toHundredths } from "@/lib/money";

describe("money (exact decimals)", () => {
  it("parses and formats without floating point errors", () => {
    expect(toHundredths("0.1") + toHundredths("0.2")).toBe(30n);
    expect(fromHundredths(toHundredths("0.1") + toHundredths("0.2"))).toBe("0.30");
    expect(addMoney("1000000.10", "0.20")).toBe("1000000.30");
    expect(subtractMoney("10.00", "10.01")).toBe("-0.01");
    expect(compareMoney("5.00", "5")).toBe(0);
  });

  it("rejects invalid amounts and more than 2 decimals", () => {
    expect(() => toHundredths("1.005")).toThrow();
    expect(() => toHundredths("abc")).toThrow();
    expect(() => toHundredths("1e5")).toThrow();
  });

  it("calculates subtotal, tax and total with half-up rounding", () => {
    const t = calculateInvoiceTotals(
      [
        { quantity: "3", unitPrice: "333.33" },
        { quantity: "1.5", unitPrice: "19.99" },
      ],
      "18",
    );
    expect(t.lineAmounts).toEqual(["999.99", "29.99"]);
    expect(t).toMatchObject({ subtotal: "1029.98", taxAmount: "185.40", total: "1215.38" });
  });

  it("handles zero tax, fractional tax rates and large values", () => {
    expect(calculateInvoiceTotals([{ quantity: "1", unitPrice: "0.10" }, { quantity: "2", unitPrice: "0.20" }], "0")).toMatchObject({
      subtotal: "0.50",
      taxAmount: "0.00",
      total: "0.50",
    });
    expect(calculateInvoiceTotals([{ quantity: "1", unitPrice: "100.00" }], "7.25").taxAmount).toBe("7.25");
    expect(calculateInvoiceTotals([{ quantity: "1000", unitPrice: "9999999.99" }], "20").total).toBe("11999999988.00");
  });

  it("rejects tax rates outside 0-100", () => {
    expect(() => calculateInvoiceTotals([{ quantity: "1", unitPrice: "1" }], "100.01")).toThrow();
  });
});
