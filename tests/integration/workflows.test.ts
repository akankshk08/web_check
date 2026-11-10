import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { notifications, projectMembers, tasks } from "@/db/schema";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import {
  addMilestoneFeedback,
  approveMilestone,
  createMilestone,
  listMilestones,
  requestMilestoneChanges,
  submitMilestoneForReview,
} from "@/server/services/milestones";
import { getProjectDetail } from "@/server/services/projects";
import { createTask, updateTaskStatus } from "@/server/services/tasks";
import { addClientUser, ctxFor, db, resetDatabase } from "../helpers/db";
import { buildAgency, makeProject } from "../helpers/fixtures";

let A: Awaited<ReturnType<typeof buildAgency>>;
let B: Awaited<ReturnType<typeof buildAgency>>;

const taskInput = (projectId: string, assigneeId = "") => ({
  projectId,
  parentTaskId: "",
  title: "Build homepage",
  description: "",
  milestoneId: "",
  assigneeId,
  priority: "HIGH" as const,
  status: "TODO" as const,
  startDate: "",
  dueDate: "",
  estimatedHours: "6",
});

beforeAll(async () => {
  await resetDatabase();
  A = await buildAgency("Gamma");
  B = await buildAgency("Delta");
});

describe("7. An admin can create and assign projects", () => {
  it("creates a project with assigned members and notifies them", async () => {
    const project = await makeProject(A.adminCtx, A.clientA.id, [A.employee.user.id, A.outsider.user.id], "Shop rebuild");
    const detail = await getProjectDetail(db, A.adminCtx, project.id);
    expect(detail.members.map((m) => m.userId).sort()).toEqual([A.employee.user.id, A.outsider.user.id].sort());
    const notes = await db.select().from(notifications).where(eq(notifications.dedupeKey, `project-created:${project.id}`));
    expect(notes.map((n) => n.userId)).toContain(A.employee.user.id);
    expect(notes.map((n) => n.userId)).not.toContain(A.adminCtx.userId); // the actor isn't notified
    // the assigned employee can now open it
    await expect(getProjectDetail(db, A.outsiderCtx, project.id)).resolves.toBeTruthy();
  });

  it("assigning a task adds the assignee to the project and notifies once", async () => {
    const task = await createTask(db, A.adminCtx, taskInput(A.projectB.id, A.outsider.user.id));
    const [pm] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, A.projectB.id), eq(projectMembers.userId, A.outsider.user.id)));
    expect(pm).toBeTruthy();
    const notes = await db.select().from(notifications).where(eq(notifications.dedupeKey, `task-assigned:${task.id}:${A.outsider.user.id}`));
    expect(notes).toHaveLength(1);
  });
});

describe("6. An employee can update their assigned tasks", () => {
  it("updates status on own task and recalculates project progress", async () => {
    const task = await createTask(db, A.ownerCtx, taskInput(A.projectA.id, A.employee.user.id));
    await updateTaskStatus(db, A.employeeCtx, { id: task.id, status: "COMPLETED" });
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id));
    expect(row?.status).toBe("COMPLETED");
    expect(row?.completedAt).toBeInstanceOf(Date);
    const detail = await getProjectDetail(db, A.ownerCtx, A.projectA.id);
    expect(detail.project.progress).toBe(100);
  });

  it("cannot update a task assigned to someone else", async () => {
    const task = await createTask(db, A.ownerCtx, taskInput(A.projectA.id, ""));
    await expect(updateTaskStatus(db, A.employeeCtx, { id: task.id, status: "IN_PROGRESS" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot create tasks (admin function) or touch other agencies' tasks", async () => {
    await expect(createTask(db, A.employeeCtx, taskInput(A.projectA.id))).rejects.toBeInstanceOf(ForbiddenError);
    const foreign = await createTask(db, B.ownerCtx, taskInput(B.projectA.id, B.employee.user.id));
    await expect(updateTaskStatus(db, A.employeeCtx, { id: foreign.id, status: "COMPLETED" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("4. Clients can approve only their own authorized milestones", () => {
  it("full review cycle: submit -> request changes -> resubmit -> approve, with history", async () => {
    const m = await createMilestone(db, A.ownerCtx, { projectId: A.projectA.id, title: "UI/UX Design", description: "", dueDate: "" });
    // cannot approve before it is submitted
    await expect(approveMilestone(db, A.clientACtx, { milestoneId: m.id, comment: "" })).rejects.toBeInstanceOf(BadRequestError);

    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "Ready" });
    await requestMilestoneChanges(db, A.clientACtx, { milestoneId: m.id, comment: "Bigger logo please" });
    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "Updated" });
    await addMilestoneFeedback(db, A.clientACtx, { milestoneId: m.id, comment: "Looks good" });
    await approveMilestone(db, A.clientACtx, { milestoneId: m.id, comment: "Approved" });

    const { milestones } = await listMilestones(db, A.clientACtx, A.projectA.id);
    const found = milestones.find((x) => x.id === m.id)!;
    expect(found.status).toBe("APPROVED");
    expect(found.history.map((h) => h.action)).toEqual(["APPROVED", "FEEDBACK", "SUBMITTED", "CHANGES_REQUESTED", "SUBMITTED"]);
  });

  it("another client (same agency) cannot approve it", async () => {
    const m = await createMilestone(db, A.ownerCtx, { projectId: A.projectA.id, title: "Frontend", description: "", dueDate: "" });
    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "" });
    await expect(approveMilestone(db, A.clientBCtx, { milestoneId: m.id, comment: "" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a client user of another agency cannot approve it", async () => {
    const m = await createMilestone(db, A.ownerCtx, { projectId: A.projectA.id, title: "Backend", description: "", dueDate: "" });
    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "" });
    await expect(approveMilestone(db, B.clientACtx, { milestoneId: m.id, comment: "" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a client user without approval rights cannot approve", async () => {
    const viewer = await addClientUser(A.org.id, A.clientA.id, "Read Only Viewer", { canApprove: false });
    const viewerCtx = await ctxFor(viewer.user.id);
    const m = await createMilestone(db, A.ownerCtx, { projectId: A.projectA.id, title: "Testing", description: "", dueDate: "" });
    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "" });
    await expect(approveMilestone(db, viewerCtx, { milestoneId: m.id, comment: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("agency staff cannot approve on the client's behalf", async () => {
    const m = await createMilestone(db, A.ownerCtx, { projectId: A.projectA.id, title: "Deployment", description: "", dueDate: "" });
    await submitMilestoneForReview(db, A.ownerCtx, { milestoneId: m.id, comment: "" });
    await expect(approveMilestone(db, A.ownerCtx, { milestoneId: m.id, comment: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
