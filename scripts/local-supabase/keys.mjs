// DEV/TEST ONLY. Generates the anon/service_role JWTs for the local Supabase stack.
import { createHmac } from "node:crypto";

export const JWT_SECRET = process.env.LOCAL_JWT_SECRET ?? "local-dev-jwt-secret-not-for-production-0123456789";

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
export function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const exp = 4102444800; // fixed (2100-01-01) so keys are stable between runs
export const ANON_KEY = sign({ role: "anon", iss: "supabase-local", exp });
export const SERVICE_KEY = sign({ role: "service_role", iss: "supabase-local", exp });

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`);
}
