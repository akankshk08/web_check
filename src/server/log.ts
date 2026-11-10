/**
 * Minimal structured logger: one JSON line per event, with sensitive keys redacted.
 * Vercel and most hosts index JSON logs automatically.
 */
const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|email/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message, code: (value as { code?: string }).code };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)]));
}

function write(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...(redact(data) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "test") console.info(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
};
