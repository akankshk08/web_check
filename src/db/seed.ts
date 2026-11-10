/**
 * DEVELOPMENT SEED DATA — never run against production.
 * Creates three independent agencies (sizes from the product spec) with login accounts
 * for every role. All seeded accounts use the password printed at the end.
 *
 *   npm run db:seed            (requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq as sqlEq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { calculateInvoiceTotals, fromHundredths, toHundredths } from "../lib/money";
import * as s from "./schema";

const PASSWORD = "Password123!";
const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || (/supabase\.(co|com)/.test(url) && process.env.SEED_ALLOW_REMOTE !== "true")) {
  console.error("Refusing to seed: this looks like a production database. Set SEED_ALLOW_REMOTE=true only for a disposable remote dev project.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(sql, { schema: s });
const supabase: SupabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Deterministic pseudo-random numbers so every seed run looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ts = (offset: number) => new Date(Date.now() + offset * 86400000);

let existing: Map<string, string> | null = null;
async function authUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (data.user) return data.user.id;
  if (!existing) {
    existing = new Map();
    for (let page = 1; page < 50; page++) {
      const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of list.users) if (u.email) existing.set(u.email, u.id);
      if (list.users.length < 1000) break;
    }
  }
  const id = existing.get(email);
  if (!id) throw new Error(`Could not create ${email}: ${error?.message}`);
  return id;
}

const FIRST = ["Ava", "Liam", "Mia", "Noah", "Zara", "Ethan", "Isla", "Omar", "Priya", "Lucas", "Sofia", "Kai", "Elena", "Ravi", "Hana", "Leo", "Nora", "Arjun", "Chloe", "Mateo"];
const LAST = ["Patel", "Nguyen", "Garcia", "Smith", "Kim", "Okafor", "Rossi", "Silva", "Müller", "Haddad", "Cohen", "Tanaka", "Fischer", "Khan", "Lopez", "Brown"];
const COMPANIES = ["Northwind Coffee", "Bluebird Dental", "Cedar & Stone Realty", "Harbor Fitness", "Lumen Labs", "Oakridge Law", "Pinecrest Hotels", "Quantum Logistics", "Riverbend Bakery", "Summit Outdoor", "Tidewater Clinic", "Urban Bloom Florists", "Vertex Analytics", "Willow Interiors", "Atlas Motors", "Beacon Insurance", "Coral Travel", "Driftwood Café", "Evergreen Schools", "Fable Books", "Granite Builders", "Horizon Solar", "Ivy Skincare", "Juniper Pets", "Kestrel Security", "Lighthouse Charity", "Maple Accounting", "Nimbus Cloud"];
const TITLES = ["Designer", "Frontend Developer", "Backend Developer", "Project Manager", "QA Engineer", "Full-stack Developer", "Content Strategist", "DevOps Engineer"];
const TEMPLATES: Record<string, { type: s.ProjectType; name: string; milestones: string[] }> = {
  ecommerce: { type: "ECOMMERCE", name: "E-commerce Website", milestones: ["UI/UX Design", "Frontend Development", "Backend Development", "Payment Integration", "Testing", "Deployment"] },
  website: { type: "WEBSITE", name: "Website Redesign", milestones: ["Discovery & Sitemap", "Design", "Development", "Content & Launch"] },
  webapp: { type: "WEB_APP", name: "Customer Portal", milestones: ["Requirements", "Prototype", "MVP Build", "Beta & Feedback", "Launch"] },
  mobile: { type: "MOBILE_APP", name: "Mobile App", milestones: ["UX Research", "App Design", "Build", "Store Release"] },
  brand: { type: "BRANDING", name: "Brand Refresh", milestones: ["Moodboards", "Logo & Identity", "Guidelines"] },
  care: { type: "MAINTENANCE", name: "Website Care Plan", milestones: ["Onboarding & Audit", "Monthly Care"] },
};
const TASK_VERBS = ["Draft", "Build", "Review", "Implement", "Test", "Polish", "Write", "Set up", "Optimise", "Fix"];
const TASK_NOUNS = ["homepage layout", "navigation", "checkout flow", "product listing", "contact form", "API endpoints", "analytics", "SEO metadata", "image assets", "accessibility pass", "email templates", "admin dashboard", "search", "performance budget", "copy deck"];

type AgencySpec = { name: string; slug: string; domain: string; employees: number; clients: number; projects: number; currency: string };
const AGENCIES: AgencySpec[] = [
  { name: "Northwind Digital", slug: "northwind", domain: "northwind.test", employees: 5, clients: 10, projects: 15, currency: "USD" },
  { name: "Pixel & Pine Studio", slug: "pixelpine", domain: "pixelpine.test", employees: 12, clients: 25, projects: 40, currency: "EUR" },
  { name: "Bytecraft Labs", slug: "bytecraft", domain: "bytecraft.test", employees: 3, clients: 4, projects: 6, currency: "GBP" },
];

async function seedAgency(spec: AgencySpec, nameOffset: number) {
  const person = (i: number) => `${FIRST[(i + nameOffset) % FIRST.length]} ${LAST[(i * 3 + nameOffset) % LAST.length]}`;
  const ownerName = person(0);
  const ownerEmail = `owner@${spec.domain}`;
  const ownerId = await authUser(ownerEmail, ownerName);
  await db.insert(s.users).values({ id: ownerId, email: ownerEmail, fullName: ownerName, jobTitle: "Founder" }).onConflictDoNothing();
  const [org] = await db
    .insert(s.organizations)
    .values({ name: spec.name, slug: `${spec.slug}-seed`, ownerId, email: ownerEmail, currency: spec.currency, defaultTaxRate: "20", invoicePrefix: spec.slug.slice(0, 3).toUpperCase(), address: "12 Market Street\nSpringfield" })
    .returning();
  const orgId = org!.id;
  await db.insert(s.organizationMembers).values({ organizationId: orgId, userId: ownerId, role: "OWNER", canManageFinances: true });

  // Staff: employees count includes the owner; the second person is an admin with finance access.
  const staff: { id: string; name: string }[] = [{ id: ownerId, name: ownerName }];
  for (let i = 1; i < spec.employees; i++) {
    const name = person(i);
    const email = i === 1 ? `admin@${spec.domain}` : i === 2 ? `employee@${spec.domain}` : `${name.split(" ")[0]!.toLowerCase()}${i}@${spec.domain}`;
    const id = await authUser(email, name);
    await db.insert(s.users).values({ id, email, fullName: name, jobTitle: i === 1 ? "Operations Lead" : pick(TITLES) }).onConflictDoNothing();
    await db.insert(s.organizationMembers).values({ organizationId: orgId, userId: id, role: i === 1 ? "ADMIN" : "EMPLOYEE", canManageFinances: i === 1 });
    staff.push({ id, name });
  }
  const workers = staff.slice(1).length ? staff.slice(1) : staff;

  // Clients; the first two get portal accounts (client@ / client2@).
  const clients: { id: string; name: string; portalUserId?: string }[] = [];
  for (let i = 0; i < spec.clients; i++) {
    const company = COMPANIES[(i + nameOffset * 2) % COMPANIES.length]!;
    const contact = person(i + 7);
    const email = `${contact.split(" ")[0]!.toLowerCase()}.${i}@${company.toLowerCase().replace(/[^a-z]/g, "")}.test`;
    const [c] = await db
      .insert(s.clients)
      .values({ organizationId: orgId, name: contact, email, companyName: company, phone: `+1 555 01${String(i).padStart(2, "0")}`, status: i % 9 === 8 ? "LEAD" : "ACTIVE", notes: i % 3 === 0 ? "Prefers updates on Fridays. Net-30 payment terms." : null, createdById: ownerId, createdAt: ts(-200 + i) })
      .returning();
    const entry: { id: string; name: string; portalUserId?: string } = { id: c!.id, name: company };
    if (i < 2) {
      const portalEmail = i === 0 ? `client@${spec.domain}` : `client2@${spec.domain}`;
      const uid = await authUser(portalEmail, contact);
      await db.insert(s.users).values({ id: uid, email: portalEmail, fullName: contact }).onConflictDoNothing();
      await db.insert(s.organizationMembers).values({ organizationId: orgId, userId: uid, role: "CLIENT" });
      await db.insert(s.clientMembers).values({ organizationId: orgId, clientId: c!.id, userId: uid });
      entry.portalUserId = uid;
    }
    clients.push(entry);
  }

  let invoiceNo = 1;
  const keys = Object.keys(TEMPLATES);
  for (let p = 0; p < spec.projects; p++) {
    const tpl = TEMPLATES[keys[p % keys.length]!]!;
    const client = clients[p % clients.length]!;
    const startOffset = -int(20, 240);
    const length = int(45, 150);
    const dueOffset = startOffset + length;
    const status: s.ProjectStatus = dueOffset < -10 ? (rand() < 0.85 ? "COMPLETED" : "CANCELLED") : pick(["PLANNING", "ACTIVE", "ACTIVE", "ACTIVE", "IN_REVIEW", "ON_HOLD"] as const);
    const team = Array.from(new Set([pick(workers), pick(workers), pick(workers)]));
    const [project] = await db
      .insert(s.projects)
      .values({
        organizationId: orgId,
        clientId: client.id,
        name: `${client.name} ${tpl.name}`,
        description: `${tpl.name} for ${client.name}: discovery, design, build and launch, with regular reviews.`,
        internalNotes: "Fixed-price engagement. Watch scope creep on integrations.",
        type: tpl.type,
        status,
        priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"] as const),
        budget: String(int(30, 400) * 100),
        startDate: day(startOffset),
        dueDate: day(dueOffset),
        createdById: ownerId,
        completedAt: status === "COMPLETED" ? ts(dueOffset - int(0, 8)) : null,
        createdAt: ts(startOffset),
      })
      .returning();
    const projectId = project!.id;
    await db.insert(s.projectMembers).values(team.map((m) => ({ organizationId: orgId, projectId, userId: m.id })));

    // Milestones + tasks
    const done = status === "COMPLETED";
    let completedTasks = 0;
    let totalTasks = 0;
    for (let mi = 0; mi < tpl.milestones.length; mi++) {
      const frac = (mi + 1) / tpl.milestones.length;
      const mDue = Math.round(startOffset + length * frac);
      const past = mDue < 0;
      const mStatus: s.MilestoneStatus = done || (past && rand() < 0.8) ? "APPROVED" : past ? "SUBMITTED" : mi === 0 || rand() < 0.3 ? "IN_PROGRESS" : "NOT_STARTED";
      const [m] = await db
        .insert(s.milestones)
        .values({
          organizationId: orgId,
          projectId,
          title: tpl.milestones[mi]!,
          description: `Deliverables and sign-off for the ${tpl.milestones[mi]!} phase.`,
          dueDate: day(mDue),
          status: mStatus,
          position: mi + 1,
          submittedAt: mStatus === "APPROVED" || mStatus === "SUBMITTED" ? ts(mDue - 2) : null,
          approvedAt: mStatus === "APPROVED" ? ts(mDue) : null,
          approvedById: mStatus === "APPROVED" ? (client.portalUserId ?? null) : null,
        })
        .returning();
      if (mStatus === "APPROVED" || mStatus === "SUBMITTED") {
        await db.insert(s.milestoneApprovals).values({ organizationId: orgId, milestoneId: m!.id, action: "SUBMITTED", actorId: ownerId, comment: "Ready for your review.", createdAt: ts(mDue - 2) });
        if (mStatus === "APPROVED") {
          await db.insert(s.milestoneApprovals).values({ organizationId: orgId, milestoneId: m!.id, action: "APPROVED", actorId: client.portalUserId ?? null, comment: "Looks great, approved.", createdAt: ts(mDue) });
        }
      }
      const n = int(2, 4);
      for (let t = 0; t < n; t++) {
        const tDue = mDue - int(0, 6);
        const tStatus: s.TaskStatus = mStatus === "APPROVED" ? "COMPLETED" : mStatus === "SUBMITTED" ? pick(["COMPLETED", "IN_REVIEW"] as const) : mStatus === "IN_PROGRESS" ? pick(["TODO", "IN_PROGRESS", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "COMPLETED"] as const) : "TODO";
        const assignee = pick(team);
        totalTasks++;
        if (tStatus === "COMPLETED") completedTasks++;
        const [task] = await db
          .insert(s.tasks)
          .values({
            organizationId: orgId,
            projectId,
            milestoneId: m!.id,
            title: `${pick(TASK_VERBS)} ${pick(TASK_NOUNS)}`,
            description: "See the brief in the project files.",
            assigneeId: assignee.id,
            priority: pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"] as const),
            status: tStatus,
            startDate: day(tDue - int(3, 10)),
            dueDate: day(tDue),
            estimatedHours: String(int(2, 16)),
            position: t + 1,
            createdById: ownerId,
            completedAt: tStatus === "COMPLETED" ? ts(Math.min(tDue, -1)) : null,
          })
          .returning();
        if (rand() < 0.35) {
          await db.insert(s.taskComments).values({ organizationId: orgId, taskId: task!.id, authorId: pick(team).id, body: pick(["Pushed a first version to staging.", "Blocked on content from the client.", "Can you review when you get a chance?", "Updated per feedback."]) });
        }
        if (tStatus !== "TODO") {
          await db.insert(s.timeEntries).values({ organizationId: orgId, projectId, taskId: task!.id, userId: assignee.id, workDate: day(Math.min(tDue, 0) - int(0, 5)), hours: String(int(1, 7)), description: "Worked on task" });
        }
      }
    }
    await db.update(s.projects).set({ progress: totalTasks ? Math.round((100 * completedTasks) / totalTasks) : 0 }).where(sqlEq(s.projects.id, projectId));

    await db.insert(s.projectComments).values([
      { organizationId: orgId, projectId, authorId: ownerId, body: "Kick-off done. Weekly check-ins on Tuesdays.", visibility: "CLIENT", createdAt: ts(startOffset + 1) },
      { organizationId: orgId, projectId, authorId: pick(team).id, body: "Internal: hosting costs need confirming before launch.", visibility: "INTERNAL", createdAt: ts(startOffset + 3) },
    ]);
    await db.insert(s.activityLogs).values({ organizationId: orgId, actorId: ownerId, projectId, entityType: "project", entityId: projectId, action: "created", summary: `${ownerName} created project ${project!.name}`, createdAt: ts(startOffset) });

    // Invoices: a deposit when started, a final invoice for completed projects.
    const invoiceDefs = [{ label: "Deposit (40%)", offset: startOffset + 2 }];
    if (done) invoiceDefs.push({ label: "Final payment (60%)", offset: dueOffset });
    for (const def of invoiceDefs) {
      const items = [{ description: `${project!.name} — ${def.label}`, quantity: "1", unitPrice: String(int(20, 120) * 50) }];
      if (rand() < 0.5) items.push({ description: "Hosting setup", quantity: "1", unitPrice: "149.00" });
      const totals = calculateInvoiceTotals(items, "20");
      const issued = def.offset;
      const age = -issued;
      const paidFully = age > 30 && rand() < 0.85;
      const partial = !paidFully && age > 10 && rand() < 0.3;
      const amountPaid = paidFully ? totals.total : partial ? fromHundredths(toHundredths(totals.total) / 2n) : "0";
      const statusInv: s.InvoiceStatus = paidFully ? "PAID" : partial ? "PARTIALLY_PAID" : age > 0 ? "SENT" : "DRAFT";
      const [inv] = await db
        .insert(s.invoices)
        .values({
          organizationId: orgId,
          clientId: client.id,
          projectId,
          number: `${spec.slug.slice(0, 3).toUpperCase()}-${String(invoiceNo++).padStart(4, "0")}`,
          status: statusInv,
          issueDate: day(issued),
          dueDate: day(issued + 30),
          currency: spec.currency,
          subtotal: totals.subtotal,
          taxRate: "20",
          taxAmount: totals.taxAmount,
          total: totals.total,
          amountPaid,
          sentAt: statusInv === "DRAFT" ? null : ts(issued),
          paidAt: paidFully ? ts(issued + int(5, 25)) : null,
          createdById: ownerId,
        })
        .returning();
      await db.insert(s.invoiceItems).values(items.map((it, i) => ({ organizationId: orgId, invoiceId: inv!.id, ...it, amount: totals.lineAmounts[i]!, position: i })));
      if (Number(amountPaid) > 0) {
        await db.insert(s.payments).values({ organizationId: orgId, invoiceId: inv!.id, amount: amountPaid, paidOn: day(Math.min(issued + int(5, 25), 0)), method: "BANK_TRANSFER", reference: `TRX-${int(10000, 99999)}`, recordedById: ownerId });
      }
    }

    // Delivery + maintenance for completed websites and care plans.
    if ((done && tpl.type !== "BRANDING") || tpl.type === "MAINTENANCE") {
      await db.insert(s.projectDeliveries).values({
        organizationId: orgId,
        projectId,
        productionUrl: `https://www.${client.name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
        hostingProvider: pick(["Vercel", "Netlify", "AWS", "SiteGround"]),
        domainProvider: pick(["Namecheap", "Cloudflare", "GoDaddy"]),
        domainExpiry: day(int(-5, 300)),
        sslExpiry: day(int(5, 80)),
        deployedOn: day(dueOffset),
        handoverNotes: "Admin access shared via the client's password manager. CMS training completed.",
        updatedById: ownerId,
      });
      await db.insert(s.maintenanceRecords).values([
        { organizationId: orgId, projectId, type: "BACKUP", title: "Monthly backup verified", status: "COMPLETED", completedOn: day(-int(3, 25)), hours: "0.5", performedById: pick(workers).id },
        { organizationId: orgId, projectId, type: "UPDATE", title: "Plugin & dependency updates", status: "SCHEDULED", scheduledFor: day(int(3, 20)), performedById: pick(workers).id },
      ]);
    }
  }

  await db.insert(s.supportTickets).values({ organizationId: orgId, clientId: clients[0]!.id, createdById: clients[0]!.portalUserId ?? null, subject: "Contact form emails not arriving", description: "Since Monday our contact form submissions don't reach our inbox.", priority: "HIGH" });
  await db.update(s.organizations).set({ nextInvoiceNumber: invoiceNo }).where(sqlEq(s.organizations.id, orgId));
  console.log(`  ✓ ${spec.name}: ${spec.employees} staff, ${spec.clients} clients, ${spec.projects} projects`);
  return spec.domain;
}


async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase URL and service role key are required to create login accounts.");
  const [row] = await sql<{ count: number }[]>`select count(*)::int as count from organizations where slug like '%-seed'`;
  if ((row?.count ?? 0) > 0) {
    console.log("Seed data already present (organizations with '-seed' slugs). Reset the database to re-seed.");
    return;
  }
  console.log("Seeding development data…");
  const domains: string[] = [];
  for (const [i, spec] of AGENCIES.entries()) domains.push(await seedAgency(spec, i * 5));
  console.log(`\nSign in with password "${PASSWORD}" as:`);
  for (const d of domains) console.log(`  owner@${d}  admin@${d}  employee@${d}  client@${d}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
