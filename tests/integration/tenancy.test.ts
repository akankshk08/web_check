import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { projects } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "@/server/services/access";
import { getAgencyDashboard } from "@/server/services/analytics";
import { getClient, listClients } from "@/server/services/clients";
import { listInvoices } from "@/server/services/invoices";
import { listMilestones } from "@/server/services/milestones";
import { listPortalProjects } from "@/server/services/portal";
import { getProjectDetail, listProjects, setProjectArchived, updateProject } from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { createInvitation, removeMember } from "@/server/services/team-exports";
import { db, resetDatabase, sqlClient } from "../helpers/db";
import { buildAgency, makeClient } from "../helpers/fixtures";

let A: Awaited<ReturnType<typeof buildAgency>>;
let B: Awaited<ReturnType<typeof buildAgency>>;

beforeAll(async () => {
  await resetDatabase();
  A = await buildAgency("Alpha");
  B = await buildAgency("Beta");
});

describe("1. Agency A cannot access Agency B's data", () => {
  it("does not list another agency's projects", async () => {
    const list = await listProjects(db, A.ownerCtx, {});
    const ids = list.rows.map((r) => r.id);
    expect(ids).toContain(A.projectA.id);
    expect(ids).not.toContain(B.projectA.id);
    expect(ids).not.toContain(B.projectB.id);
  });

  it("returns not found (not forbidden) when opening another agency's project", async () => {
    await expect(getProjectDetail(db, A.ownerCtx, B.projectA.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot update, archive or add tasks to another agency's project", async () => {
    const input = {
      name: "Hacked",
      description: "",
      internalNotes: "",
      clientId: B.clientA.id,
      type: "WEBSITE" as const,
      status: "ACTIVE" as const,
      priority: "LOW" as const,
      budget: "",
      startDate: "",
      dueDate: "",
      memberIds: [],
    };
    await expect(updateProject(db, A.ownerCtx, B.projectA.id, input)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setProjectArchived(db, A.ownerCtx, B.projectA.id, true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createTask(db, A.ownerCtx, {
        projectId: B.projectA.id,
        parentTaskId: "",
        title: "x",
        description: "",
        milestoneId: "",
        assigneeId: "",
        priority: "LOW",
        status: "TODO",
        startDate: "",
        dueDate: "",
        estimatedHours: "",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const [row] = await db.select({ name: projects.name }).from(projects).where(sql`${projects.id} = ${B.projectA.id}`);
    expect(row?.name).not.toBe("Hacked");
  });

  it("cannot read another agency's clients, invoices or milestones", async () => {
    await expect(getClient(db, A.ownerCtx, B.clientA.id)).rejects.toBeInstanceOf(NotFoundError);
    const clients = await listClients(db, A.ownerCtx, {});
    expect(clients.rows.map((c) => c.id)).not.toContain(B.clientA.id);
    const invoices = await listInvoices(db, A.ownerCtx, {});
    expect(invoices.rows).toHaveLength(0);
    await expect(listMilestones(db, A.ownerCtx, B.projectA.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot assign a project to another agency's client or staff", async () => {
    const input = {
      name: "Cross-org",
      description: "",
      internalNotes: "",
      clientId: B.clientA.id,
      type: "WEBSITE" as const,
      status: "ACTIVE" as const,
      priority: "LOW" as const,
      budget: "",
      startDate: "",
      dueDate: "",
      memberIds: [],
    };
    await expect(updateProject(db, A.ownerCtx, A.projectA.id, input)).rejects.toThrow(/valid client/);
    await expect(
      updateProject(db, A.ownerCtx, A.projectA.id, { ...input, clientId: A.clientA.id, memberIds: [B.employee.user.id] }),
    ).rejects.toThrow(/not in this workspace/);
  });

  it("the database itself rejects cross-organization links (composite foreign keys)", async () => {
    await expect(
      db.insert(projects).values({ organizationId: A.org.id, clientId: B.clientA.id, name: "Bad link" }),
    ).rejects.toThrow();
  });

  it("dashboard figures only include the agency's own records", async () => {
    const dash = await getAgencyDashboard(db, A.ownerCtx);
    expect(dash.stats.totalClients).toBe(2);
    expect(dash.stats.activeProjects).toBe(2);
  });
});

describe("2. Employees cannot use administrative functions", () => {
  it("rejects admin-only operations", async () => {
    await expect(listClients(db, A.employeeCtx, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeClient(A.employeeCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listInvoices(db, A.employeeCtx, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getAgencyDashboard(db, A.employeeCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createInvitation(db, A.employeeCtx, { email: "x@example.test", role: "EMPLOYEE" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeMember(db, A.employeeCtx, A.outsider.memberId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setProjectArchived(db, A.employeeCtx, A.projectA.id, true)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admins without finance access cannot see invoices; the owner can", async () => {
    await expect(listInvoices(db, A.adminCtx, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listInvoices(db, A.ownerCtx, {})).resolves.toBeTruthy();
  });

  it("admins cannot invite other admins (owner only)", async () => {
    await expect(createInvitation(db, A.adminCtx, { email: "boss@example.test", role: "ADMIN" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("employees only see projects they are assigned to", async () => {
    const list = await listProjects(db, A.employeeCtx, {});
    expect(list.rows.map((r) => r.id)).toEqual([A.projectA.id]);
    await expect(getProjectDetail(db, A.employeeCtx, A.projectB.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("employees never receive budget or internal notes", async () => {
    const detail = await getProjectDetail(db, A.employeeCtx, A.projectA.id);
    expect(detail.project.budget).toBeNull();
    expect(detail.project.internalNotes).toBeNull();
  });
});

describe("3. Clients cannot access other clients' projects", () => {
  it("lists only the client's own projects", async () => {
    const own = await listPortalProjects(db, A.clientACtx);
    expect(own.map((p) => p.id)).toEqual([A.projectA.id]);
    expect(own[0]).not.toHaveProperty("internalNotes");
    expect(own[0]).not.toHaveProperty("budget");
  });

  it("rejects another client's project in the same agency", async () => {
    await expect(getAccessibleProject(db, A.clientACtx, A.projectB.id, { allowClient: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMilestones(db, A.clientACtx, A.projectB.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("clients cannot use staff views at all", async () => {
    await expect(getProjectDetail(db, A.clientACtx, A.projectA.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listProjects(db, A.clientACtx, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Row Level Security (database-level isolation)", () => {
  async function asUser<T>(userId: string, query: string): Promise<T[]> {
    return sqlClient.begin(async (tx) => {
      await tx.unsafe("set local role authenticated");
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      return (await tx.unsafe(query)) as unknown as T[];
    }) as Promise<T[]>;
  }

  it("an agency owner sees only their own organization's projects", async () => {
    const rows = await asUser<{ id: string; organization_id: string }>(A.owner.id, "select id, organization_id from projects");
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.organization_id === A.org.id)).toBe(true);
  });

  it("a client user sees only their own client's project and no internal comments", async () => {
    const rows = await asUser<{ id: string }>(A.clientUserA.user.id, "select id from projects");
    expect(rows.map((r) => r.id)).toEqual([A.projectA.id]);
    const tasks = await asUser(A.clientUserA.user.id, "select id from tasks");
    expect(tasks).toHaveLength(0);
  });

  it("users without membership and anonymous requests see nothing; nobody can write directly", async () => {
    const stranger = await asUser("00000000-0000-0000-0000-000000000000", "select id from projects");
    expect(stranger).toHaveLength(0);
    await expect(
      sqlClient.begin(async (tx) => {
        await tx.unsafe("set local role anon");
        return tx.unsafe("select id from projects");
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(A.owner.id, `update projects set name = 'x' where id = '${A.projectA.id}'`)).rejects.toThrow(/permission denied/);
  });
});
