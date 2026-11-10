/**
 * Exact decimal money maths using integer minor units (BigInt). Never floats.
 * Amounts are exchanged with the database as strings like "1234.50".
 */
const DECIMAL_RE = /^-?\d{1,12}(\.\d{1,2})?$/;

/** "12.5" -> 1250n (hundredths). Throws on invalid input or more than 2 decimals. */
export function toHundredths(value: string | number): bigint {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!DECIMAL_RE.test(s)) throw new Error(`Invalid decimal amount: ${value}`);
  const negative = s.startsWith("-");
  const [whole = "0", frac = ""] = s.replace("-", "").split(".");
  const n = BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
  return negative ? -n : n;
}

/** 1250n -> "12.50" */
export function fromHundredths(n: bigint): string {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Divide and round half away from zero. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;
  const q = (a * 2n + b) / (2n * b);
  return negative ? -q : q;
}

export type InvoiceLineInput = { quantity: string; unitPrice: string };
export type InvoiceTotals = {
  lineAmounts: string[];
  subtotal: string;
  taxAmount: string;
  total: string;
};

/** Line amount = quantity x unit price; tax = subtotal x rate%; all rounded to cents. */
export function calculateInvoiceTotals(lines: InvoiceLineInput[], taxRatePercent: string): InvoiceTotals {
  const lineCents = lines.map((l) => divRound(toHundredths(l.quantity) * toHundredths(l.unitPrice), 100n));
  const subtotal = lineCents.reduce((sum, c) => sum + c, 0n);
  const rate = toHundredths(taxRatePercent); // 18.5% -> 1850
  if (rate < 0n || rate > 10000n) throw new Error("Tax rate must be between 0 and 100");
  const tax = divRound(subtotal * rate, 10000n);
  return {
    lineAmounts: lineCents.map(fromHundredths),
    subtotal: fromHundredths(subtotal),
    taxAmount: fromHundredths(tax),
    total: fromHundredths(subtotal + tax),
  };
}

export function addMoney(a: string, b: string): string {
  return fromHundredths(toHundredths(a) + toHundredths(b));
}

export function subtractMoney(a: string, b: string): string {
  return fromHundredths(toHundredths(a) - toHundredths(b));
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const d = toHundredths(a) - toHundredths(b);
  return d === 0n ? 0 : d < 0n ? -1 : 1;
}

export function formatMoney(amount: string | number | null | undefined, currency = "USD"): string {
  const n = amount == null ? 0 : Number(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}
