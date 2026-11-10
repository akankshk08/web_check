import { createClient } from "@/server/services/clients";
import { createProject } from "@/server/services/projects";
import type { AuthContext } from "@/server/auth/types";
import { addClientUser, addMember, createAgency, ctxFor, db } from "./db";

let counter = 0;

export async function makeClient(ctx: AuthContext, name = "Client") {
  counter += 1;
  return createClient(db, ctx, {
    name: `${name} Contact`,
    email: `client${counter}.${Date.now()}@example.test`,
    companyName: `${name} Ltd`,
    phone: "",
    address: "",
    notes: "Internal note: slow payer",
    status: "ACTIVE",
  });
}

export async function makeProject(ctx: AuthContext, clientId: string, memberIds: string[] = [], name = "Website") {
  return createProject(db, ctx, {
    name,
    description: "Project description",
    internalNotes: "Internal margin notes",
    clientId,
    type: "WEBSITE",
    status: "ACTIVE",
    priority: "MEDIUM",
    budget: "12000.00",
    startDate: "2026-01-01",
    dueDate: "2026-12-31",
    memberIds,
  });
}

/** One agency with an owner, admin, two employees, two clients (each with a portal user) and projects. */
export async function buildAgency(name: string) {
  const { org, owner } = await createAgency(name);
  const ownerCtx = await ctxFor(owner.id);
  const admin = await addMember(org.id, "ADMIN", `${name} Admin`);
  const employee = await addMember(org.id, "EMPLOYEE", `${name} Employee`);
  const outsider = await addMember(org.id, "EMPLOYEE", `${name} Other Employee`);
  const clientA = await makeClient(ownerCtx, `${name} Client A`);
  const clientB = await makeClient(ownerCtx, `${name} Client B`);
  const clientUserA = await addClientUser(org.id, clientA.id, `${name} Client User A`);
  const clientUserB = await addClientUser(org.id, clientB.id, `${name} Client User B`);
  const projectA = await makeProject(ownerCtx, clientA.id, [employee.user.id], `${name} Project A`);
  const projectB = await makeProject(ownerCtx, clientB.id, [], `${name} Project B`);
  return {
    org,
    owner,
    ownerCtx,
    adminCtx: await ctxFor(admin.user.id),
    employee,
    employeeCtx: await ctxFor(employee.user.id),
    outsider,
    outsiderCtx: await ctxFor(outsider.user.id),
    clientA,
    clientB,
    clientUserA,
    clientUserB,
    clientACtx: await ctxFor(clientUserA.user.id),
    clientBCtx: await ctxFor(clientUserB.user.id),
    projectA,
    projectB,
  };
}

export class FakeStorage {
  objects = new Map<string, number>();
  removed: string[] = [];
  async createSignedUploadUrl(path: string) {
    return { token: `token-${path}`, path };
  }
  async createSignedDownloadUrl(path: string, expires: number) {
    return `https://storage.test/${path}?expires=${expires}`;
  }
  async objectSize(path: string) {
    return this.objects.get(path) ?? null;
  }
  async remove(paths: string[]) {
    this.removed.push(...paths);
    for (const p of paths) this.objects.delete(p);
  }
}
