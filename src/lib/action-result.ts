export type FieldErrors = Record<string, string[] | undefined>;
export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };
