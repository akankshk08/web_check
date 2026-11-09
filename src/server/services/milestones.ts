import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { attachments, clientMembers, milestoneApprovals, milestones, tasks, users } from "@/db/schema";
import type { ApprovalAction } from "@/db/schema/enums";
import { nn } from "@/lib/validations/common";
import type { milestoneSchema, updateMilestoneSchema } from "@/lib/validations/entities";
import { assertClient, assertManager, isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { clientUserIds } from "./clients";
import { notify } from "./notifications";
import { managerUserIds, projectMemberIds } from "./projects";

/** Milestones for a project (staff with access, or the project's client). */
export async function listMilestones(db: DbOrTx, ctx: AuthContext, projectId: string) {
  const project = await getAccessibleProject(db, ctx, projectId, { allowClient: true });
  const rows = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      description: milestones.description,
      dueDate: milestones.dueDate,
      status: milestones.status,
      position: milestones.position,
      submittedAt: milestones.submittedAt,
      approvedAt: milestones.approvedAt,
      taskTotal: sql<number>`(select count(*)::int from tasks t where t.milestone_id = ${milestones.id} and t.archived_at is null and t.status <> 'CANCELLED')`,
      taskDone: sql<number>`(select count(*)::int from tasks t where t.milestone_id = ${milestones.id} and t.archived_at is null and t.status = 'COMPLETED')`,
    })
    .from(milestones)
    .where(and(eq(milestones.projectId, project.id), isNull(milestones.deletedAt)))
    .orderBy(asc(milestones.position), asc(milestones.createdAt));

  const ids = rows.map((r) => r.id);
  const [history, deliverables] = ids.length
    ? await Promise.all([
        db
          .select({
            id: milestoneApprovals.id,
            milestoneId: milestoneApprovals.milestoneId,
            action: milestoneApprovals.action,
            comment: milestoneApprovals.comment,
            createdAt: milestoneApprovals.createdAt,
            actorName: users.fullName,
          })
          .from(milestoneApprovals)
          .leftJoin(users, eq(users.id, milestoneApprovals.actorId))
          .where(inArray(milestoneApprovals.milestoneId, ids))
          .orderBy(desc(milestoneApprovals.createdAt)),
        db
          .select({
            id: attachments.id,
            milestoneId: attachments.milestoneId,
            fileName: attachments.fileName,
            sizeBytes: attachments.sizeBytes,
            createdAt: attachments.createdAt,
            visibility: attachments.visibility,
          })
          .from(attachments)
          .where(
            and(
              inArray(attachments.milestoneId, ids),
              isNull(attachments.deletedAt),
              eq(attachments.status, "READY"),
              isClient(ctx) ? eq(attachments.visibility, "CLIENT") : undefined,
            ),
          )
          .orderBy(desc(attachments.createdAt)),
      ])
    : [[], []];

  return {
    project,
    milestones: rows.map((m) => ({
      ...m,
      history: history.filter((h) => h.milestoneId === m.id),
      deliverables: deliverables.filter((d) => d.milestoneId === m.id),
    })),
  };
}

async function getMilestone(db: DbOrTx, ctx: AuthContext, milestoneId: string) {
  const [m] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.organizationId, ctx.orgId), isNull(milestones.deletedAt)))
    .limit(1);
  if (!m) throw new NotFoundError("Milestone not found.");
  const project = await getAccessibleProject(db, ctx, m.projectId, { allowClient: true });
  return { milestone: m, project };
}

export async function createMilestone(db: Database, ctx: AuthContext, input: z.infer<typeof milestoneSchema>) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  return db.transaction(async (tx) => {
    const [{ maxPos } = { maxPos: 0 }] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${milestones.position}), 0)::int` })
      .from(milestones)
      .where(eq(milestones.projectId, project.id));
    const [m] = await tx
      .insert(milestones)
      .values({
        organizationId: ctx.orgId,
        projectId: project.id,
        title: input.title,
        description: nn(input.description),
        dueDate: nn(input.dueDate),
        position: maxPos + 1,
      })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "milestone",
      entityId: m!.id,
      projectId: project.id,
      action: "created",
      summary: `${ctx.fullName} added milestone ${m!.title}`,
      clientVisible: true,
    });
    return m!;
  });
}

export async function updateMilestone(db: Database, ctx: AuthContext, input: z.infer<typeof updateMilestoneSchema>) {
  assertManager(ctx);
  const { milestone, project } = await getMilestone(db, ctx, input.id);
  // Review states (submitted/approved/changes requested) are only changed through the review workflow.
  const status = milestone.status === "NOT_STARTED" || milestone.status === "IN_PROGRESS" ? input.status : milestone.status;
  await db.transaction(async (tx) => {
    await tx
      .update(milestones)
      .set({ title: input.title, description: nn(input.description), dueDate: nn(input.dueDate), status })
      .where(eq(milestones.id, milestone.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "milestone",
      entityId: milestone.id,
      projectId: project.id,
      action: "updated",
      summary: `${ctx.fullName} updated milestone ${input.title}`,
    });
  });
}

export async function deleteMilestone(db: Database, ctx: AuthContext, milestoneId: string) {
  assertManager(ctx);
  const { milestone, project } = await getMilestone(db, ctx, milestoneId);
  if (milestone.status === "APPROVED") throw new BadRequestError("Approved milestones can't be deleted.");
  await db.transaction(async (tx) => {
    await tx.update(milestones).set({ deletedAt: new Date() }).where(eq(milestones.id, milestone.id));
    await tx.update(tasks).set({ milestoneId: null }).where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.milestoneId, milestone.id)));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "milestone",
      entityId: milestone.id,
      projectId: project.id,
      action: "deleted",
      summary: `${ctx.fullName} deleted milestone ${milestone.title}`,
    });
  });
}

/** Agency submits a milestone (and its shared deliverables) for client review. */
export async function submitMilestoneForReview(db: Database, ctx: AuthContext, input: { milestoneId: string; comment: string }) {
  assertManager(ctx);
  const { milestone, project } = await getMilestone(db, ctx, input.milestoneId);
  if (milestone.status === "APPROVED") throw new BadRequestError("This milestone is already approved.");
  if (milestone.status === "SUBMITTED") throw new BadRequestError("This milestone is already awaiting review.");
  const submittedAt = new Date();
  await db.transaction(async (tx) => {
    await tx.update(milestones).set({ status: "SUBMITTED", submittedAt }).where(eq(milestones.id, milestone.id));
    await tx.insert(milestoneApprovals).values({
      organizationId: ctx.orgId,
      milestoneId: milestone.id,
      action: "SUBMITTED",
      actorId: ctx.userId,
      comment: nn(input.comment),
    });
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "milestone",
      entityId: milestone.id,
      projectId: project.id,
      action: "submitted",
      summary: `${milestone.title} was submitted for client review`,
      clientVisible: true,
    });
  });
  await notify(db, {
    orgId: ctx.orgId,
    userIds: await clientUserIds(db, ctx.orgId, project.clientId, { approversOnly: true }),
    actorId: ctx.userId,
    type: "milestone_submitted",
    title: `Ready for review: ${milestone.title}`,
    body: `${milestone.title} on ${project.name} is ready for your review.`,
    link: `/portal/projects/${project.id}/milestones`,
    dedupeKey: `milestone-submitted:${milestone.id}:${submittedAt.getTime()}`,
    email: true,
  });
}

/** Client decision. Only client users of the project's client account with approval rights. */
async function clientDecision(db: Database, ctx: AuthContext, milestoneId: string, action: ApprovalAction, comment: string) {
  assertClient(ctx);
  const { milestone, project } = await getMilestone(db, ctx, milestoneId);
  if (!ctx.clientIds.includes(project.clientId)) throw new NotFoundError("Milestone not found.");
  if (action !== "FEEDBACK") {
    const [membership] = await db
      .select({ canApprove: clientMembers.canApprove })
      .from(clientMembers)
      .where(and(eq(clientMembers.clientId, project.clientId), eq(clientMembers.userId, ctx.userId)))
      .limit(1);
    if (!membership?.canApprove) throw new ForbiddenError("You are not allowed to approve milestones for this account.");
    if (milestone.status !== "SUBMITTED") throw new BadRequestError("This milestone is not awaiting your review.");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (action === "APPROVED") {
      await tx
        .update(milestones)
        .set({ status: "APPROVED", approvedAt: now, approvedById: ctx.userId })
        .where(and(eq(milestones.id, milestone.id), eq(milestones.status, "SUBMITTED")));
    } else if (action === "CHANGES_REQUESTED") {
      await tx
        .update(milestones)
        .set({ status: "CHANGES_REQUESTED" })
        .where(and(eq(milestones.id, milestone.id), eq(milestones.status, "SUBMITTED")));
    }
    await tx.insert(milestoneApprovals).values({
      organizationId: ctx.orgId,
      milestoneId: milestone.id,
      action,
      actorId: ctx.userId,
      comment: nn(comment),
    });
    const verb = action === "APPROVED" ? "approved" : action === "CHANGES_REQUESTED" ? "requested changes on" : "left feedback on";
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "milestone",
      entityId: milestone.id,
      projectId: project.id,
      action: action.toLowerCase(),
      summary: `${ctx.fullName} ${verb} ${milestone.title}`,
      clientVisible: true,
    });
  });

  const titles: Record<ApprovalAction, string> = {
    APPROVED: `Milestone approved: ${milestone.title}`,
    CHANGES_REQUESTED: `Changes requested: ${milestone.title}`,
    FEEDBACK: `Client feedback on ${milestone.title}`,
    SUBMITTED: "",
  };
  await notify(db, {
    orgId: ctx.orgId,
    userIds: [...(await managerUserIds(db, ctx.orgId)), ...(await projectMemberIds(db, project.id))],
    actorId: ctx.userId,
    type: `milestone_${action.toLowerCase()}`,
    title: titles[action],
    body: comment ? comment.slice(0, 300) : `${ctx.fullName} reviewed ${milestone.title} on ${project.name}.`,
    link: `/app/projects/${project.id}/milestones`,
    dedupeKey: `milestone-${action.toLowerCase()}:${milestone.id}:${now.getTime()}`,
    email: action !== "FEEDBACK",
  });
}

export const approveMilestone = (db: Database, ctx: AuthContext, input: { milestoneId: string; comment: string }) =>
  clientDecision(db, ctx, input.milestoneId, "APPROVED", input.comment);
export const requestMilestoneChanges = (db: Database, ctx: AuthContext, input: { milestoneId: string; comment: string }) =>
  clientDecision(db, ctx, input.milestoneId, "CHANGES_REQUESTED", input.comment);
export const addMilestoneFeedback = (db: Database, ctx: AuthContext, input: { milestoneId: string; comment: string }) =>
  clientDecision(db, ctx, input.milestoneId, "FEEDBACK", input.comment);

/** Milestone options for task forms. */
export async function listMilestoneOptions(db: DbOrTx, ctx: AuthContext, projectId: string) {
  const project = await getAccessibleProject(db, ctx, projectId);
  return db
    .select({ id: milestones.id, title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.projectId, project.id), isNull(milestones.deletedAt)))
    .orderBy(asc(milestones.position));
}
