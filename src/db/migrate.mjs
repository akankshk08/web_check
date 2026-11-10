// Applies database migrations: `npm run db:migrate`.
// Plain JavaScript (no build tools needed), reads settings from .env if present.
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Run  npm run setup  first.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "src/db/migrations" });
  console.log("Migrations applied.");
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
