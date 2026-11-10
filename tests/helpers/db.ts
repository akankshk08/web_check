import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { Database } from "@/db";
import type { OrgRole } from "@/db/schema/enums";
import { loadAuthContext } from "@/server/auth/load-context";
import type { AuthContext } from "@/server/auth/types";
import { createAgencyForUser } from "@/server/services/organizations";

export const sqlClient = postgres(process.env.DATABASE_URL!, { max: 5, onnotice: () => {} });
export const db = drizzle(sqlClient, { schema }) as unknown as Database;

let migrated = false;
export async function resetDatabase() {
  if (!migrated) {
    await migrate(drizzle(sqlClient), { migrationsFolder: "src/db/migrations" });
    migrated = true;
  }
  const tables = await sqlClient<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'`;
  await sqlClient.unsafe(`truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} restart identity cascade`);
}

export async function createUser(name: string, email?: string) {
  const id = randomUUID();
  const mail = (email ?? `${name.toLowerCase().replace(/\s+/g, ".")}.${id.slice(0, 6)}@example.test`).toLowerCase();
  await db.insert(schema.users).values({ id, email: mail, fullName: name });
  return { id, email: mail, fullName: name };
}

export async function createAgency(name: string) {
  const owner = await createUser(`${name} Owner`);
  const org = await createAgencyForUser(db, { userId: owner.id, email: owner.email, fullName: owner.fullName, agencyName: name });
  return { org, owner };
}

export async function addMember(orgId: string, role: OrgRole, name: string, opts: { canManageFinances?: boolean } = {}) {
  const user = await createUser(name);
  const [m] = await db
    .insert(schema.organizationMembers)
    .values({ organizationId: orgId, userId: user.id, role, canManageFinances: opts.canManageFinances ?? false })
    .returning();
  return { user, memberId: m!.id };
}

export async function addClientUser(orgId: string, clientId: string, name: string, opts: { canApprove?: boolean } = {}) {
  const { user, memberId } = await addMember(orgId, "CLIENT", name);
  await db.insert(schema.clientMembers).values({ organizationId: orgId, clientId, userId: user.id, canApprove: opts.canApprove ?? true });
  return { user, memberId };
}

export async function ctxFor(userId: string, orgId?: string): Promise<AuthContext> {
  const ctx = await loadAuthContext(db, userId, orgId);
  if (!ctx) throw new Error("no context");
  return ctx;
}
