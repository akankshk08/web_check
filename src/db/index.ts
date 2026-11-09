import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/server-env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction. Services accept either. */
export type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { __agencyosSql?: postgres.Sql };

function createClient() {
  const env = serverEnv();
  return postgres(env.DATABASE_URL, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 15000 },
  });
}

let instance: Database | undefined;

export function getDb(): Database {
  if (!instance) {
    const sql = globalForDb.__agencyosSql ?? createClient();
    if (process.env.NODE_ENV !== "production") globalForDb.__agencyosSql = sql;
    instance = drizzle(sql, { schema });
  }
  return instance;
}

export { schema };
