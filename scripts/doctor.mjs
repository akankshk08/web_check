// Setup checker: `npm run doctor`. Explains in plain English what is missing before `npm run dev`.
import { existsSync, readFileSync } from "node:fs";

const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m, fix) => {
  console.log(`  ❌ ${m}\n     → ${fix.replace(/\n/g, "\n       ")}`);
  failed = true;
};
let failed = false;
console.log("\nAgencyOS setup check\n");

// 1. Node version
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`Node.js ${process.versions.node}`);
else bad(`Node.js ${process.versions.node} is too old`, "Install Node.js 22 (LTS) from https://nodejs.org, then reopen the terminal.");

// 2. Dependencies
if (existsSync("node_modules/next")) ok("Packages installed");
else bad("Packages are not installed", "Run:  npm install");

// 3. .env file
const PLACEHOLDERS = ["your-project", "your-anon-key", "your-service-role-key", "replace-with"];
let env = {};
if (!existsSync(".env")) {
  bad("No .env settings file", "Copy the example:  cp .env.example .env   (Windows: copy .env.example .env)\nthen fill in the values (see README → Quick start).");
} else {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const need = {
    NEXT_PUBLIC_SUPABASE_URL: "Supabase → Project Settings → API → Project URL",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase → Project Settings → API → anon public key",
    SUPABASE_SERVICE_ROLE_KEY: "Supabase → Project Settings → API → service_role key (keep secret)",
    DATABASE_URL: "Supabase → Connect → Connection string (Transaction pooler, port 6543), with your database password filled in",
    CRON_SECRET: "Any random text of 32+ characters",
  };
  let allSet = true;
  for (const [key, where] of Object.entries(need)) {
    const v = env[key] ?? "";
    if (!v || PLACEHOLDERS.some((p) => v.includes(p))) {
      bad(`${key} is not set in .env`, where);
      allSet = false;
    } else if (key === "CRON_SECRET" && v.length < 32) {
      bad("CRON_SECRET is shorter than 32 characters", "Make it longer (any random text).");
      allSet = false;
    }
  }
  if (allSet) ok(".env has all required settings");
}

// 4. Database connection + migrations
if (env.DATABASE_URL && existsSync("node_modules/postgres")) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 8, onnotice: () => {} });
  try {
    await sql`select 1`;
    ok("Database connection works");
    const [row] = await sql`select to_regclass('public.organizations') as t`;
    if (row?.t) ok("Database tables exist (migrations applied)");
    else bad("Database tables are missing", "Run:  npm run db:migrate");
  } catch (e) {
    bad(`Can't connect to the database (${e.code ?? e.message})`, "Check DATABASE_URL in .env — especially the password, and that the database is running.");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

// 5. Supabase Auth reachable
if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !PLACEHOLDERS.some((p) => env.NEXT_PUBLIC_SUPABASE_URL.includes(p))) {
  try {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) ok("Supabase Auth is reachable");
    else bad(`Supabase Auth answered with status ${r.status}`, "Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  } catch {
    bad("Can't reach Supabase", "Check NEXT_PUBLIC_SUPABASE_URL (it looks like https://xxxx.supabase.co) and your internet connection.");
  }
}

console.log(failed ? "\nFix the ❌ items above, then run  npm run doctor  again.\n" : "\nAll good! Start the app with:  npm run dev   then open http://localhost:3000\n");
process.exit(failed ? 1 : 0);
