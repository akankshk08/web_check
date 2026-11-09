// Guided setup: `npm run setup`. Asks for the Supabase values, writes .env,
// creates the database tables and checks everything.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

// Queue input lines so pasted or piped answers are never lost.
const rl = createInterface({ input: stdin });
const lines = [];
const waiters = [];
rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
rl.on("close", () => waiters.splice(0).forEach((w) => w("")));
const readLine = () => (lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => waiters.push(r)));
const ask = async (q, check) => {
  for (;;) {
    stdout.write(q);
    const a = (await readLine()).trim().replace(/^["']|["']$/g, "");
    if (!stdin.isTTY) stdout.write("\n");
    const problem = check?.(a);
    if (!problem) return a;
    console.log(`   ⚠ ${problem}\n`);
  }
};
const run = (cmd) => spawnSync(cmd, { stdio: "inherit", shell: true }).status === 0;

if (!existsSync("node_modules/.bin/tsx") && !existsSync("node_modules/tsx")) {
  console.log("\n❌ The project's packages aren't installed yet.\n   Run  npm install  first, then  npm run setup  again.\n");
  process.exit(1);
}

console.log(`
AgencyOS setup
==============
You need a free Supabase project (https://supabase.com → New project).
I'll ask for 4 things from it. Paste each one and press Enter.
`);

if (existsSync(".env")) {
  const again = await ask("A .env settings file already exists. Replace it? (yes/no) ");
  if (!/^y/i.test(again)) {
    console.log("Keeping your existing .env. Run  npm run doctor  to check it.");
    process.exit(0);
  }
}

console.log("1) Supabase → Project Settings → Data API → Project URL");
const url = await ask("   Project URL: ", (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.(co|com|in)\/?$/.test(v) || /^http:\/\/localhost/.test(v) ? null : "That should look like https://abcd1234.supabase.co"));

console.log("\n2) Supabase → Project Settings → API Keys → anon public key");
const anon = await ask("   anon key: ", (v) => (v.length > 30 ? null : "That looks too short — copy the whole key."));

console.log("\n3) Same page → service_role key (click Reveal). This is secret — it only goes into your .env file.");
const service = await ask("   service_role key: ", (v) => (v.length > 30 && v !== anon ? null : v === anon ? "That's the anon key again — use the service_role one." : "That looks too short — copy the whole key."));

console.log("\n4) Green 'Connect' button → Transaction pooler → copy the line starting with postgresql://");
let db = await ask("   Connection string: ", (v) => (/^postgres(ql)?:\/\//.test(v) ? null : "It should start with postgresql://"));
if (db.includes("[YOUR-PASSWORD]")) {
  const pw = await ask("   Your database password (the one you chose when creating the project): ", (v) => (v ? null : "Please type the password."));
  db = db.replace("[YOUR-PASSWORD]", encodeURIComponent(pw));
}
rl.close();

const example = existsSync(".env.example") ? readFileSync(".env.example", "utf8") : "";
const values = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: url.replace(/\/$/, ""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  DATABASE_URL: db,
  SUPABASE_STORAGE_BUCKET: "attachments",
  CRON_SECRET: randomBytes(32).toString("hex"),
};
let out = example || Object.keys(values).map((k) => `${k}=`).join("\n");
for (const [k, v] of Object.entries(values)) {
  out = new RegExp(`^${k}=.*$`, "m").test(out) ? out.replace(new RegExp(`^${k}=.*$`, "m"), () => `${k}=${v}`) : `${out}\n${k}=${v}`;
}
writeFileSync(".env", out);
console.log("\n✅ Saved your settings to .env\n");

console.log("Creating the database tables…");
if (!run("npm run db:migrate")) {
  console.log("\n❌ Creating the tables failed. Read the error above:\n   - 'password authentication failed' or 'ENOTFOUND' → re-run  npm run setup  and re-check the connection string and password\n   - anything else → send the error to whoever is helping you.\n   Your settings are saved, so after fixing you can also just run  npm run db:migrate");
  process.exit(1);
}
console.log("\nChecking everything…");
const good = run("npm run doctor");
if (good) {
  console.log(`Done! Start the app with:

   npm run dev

then open http://localhost:3000 and click "Start free".
Tip: in Supabase → Authentication → Sign In / Providers → Email, turn off "Confirm email"
so you can sign up locally without a confirmation email.`);
}
process.exit(good ? 0 : 1);
