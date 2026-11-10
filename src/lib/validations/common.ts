import { z } from "zod";

/** Optional free-text field. Empty string means "not set". */
export const optionalText = (max = 2000) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `Must be ${max} characters or fewer`);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const uuid = z.uuid("Invalid id");
export const optionalUuid = z.union([z.uuid(), z.literal("")]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || (DATE_RE.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date");
export const requiredDate = z
  .string()
  .trim()
  .refine((v) => DATE_RE.test(v) && !Number.isNaN(Date.parse(v)), "Enter a valid date");

/** Non-negative money/decimal string with up to 2 decimal places. */
export const decimalString = (label: string, { allowEmpty = false, max = 9_999_999_999.99 } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => (allowEmpty && v === "") || /^\d{1,10}(\.\d{1,2})?$/.test(v), `${label} must be a number with up to 2 decimals`)
    .refine((v) => v === "" || Number(v) <= max, `${label} is too large`);

export const pageParam = z.coerce.number().int().min(1).max(10_000).catch(1);

/** "" -> null for database writes. */
export const nn = <T extends string>(v: T | undefined | null): T | null => (v === undefined || v === null || v === "" ? null : v);
