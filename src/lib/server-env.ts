import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("attachments"),
  RESEND_API_KEY: z.string().optional().transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z.string().default("AgencyOS <notifications@example.com>"),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
let cached: ServerEnv | undefined;

/** Validated server configuration. Throws a clear error on misconfiguration. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid server environment configuration: ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
