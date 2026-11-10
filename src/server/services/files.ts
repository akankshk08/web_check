import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { attachments, milestones, tasks, users } from "@/db/schema";
import { sanitizeFileName, validateFileMeta } from "@/lib/files";
import { optionalUuid, uuid } from "@/lib/validations/common";
import { assertStaff, isClient, isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/server/errors";
import type { StorageAdapter } from "@/server/storage";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { clientUserIds } from "./clients";
import { notify } from "./notifications";

export const DOWNLOAD_URL_TTL_SECONDS = 60;

export const uploadRequestSchema = z
  .object({
    projectId: uuid,
    taskId: optionalUuid,
    milestoneId: optionalUuid,
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    shareWithClient: z.boolean(),
    isDeliverable: z.boolean(),
  })
  .strict();

/**
 * Step 1 of an upload: check access + file rules, reserve a PENDING record and
 * return a one-time signed upload token for a private storage path.
 */
export async function requestUpload(db: DbOrTx, storage: StorageAdapter, ctx: AuthContext, raw: z.input<typeof uploadRequestSchema>) {
  assertStaff(ctx);
  const input = uploadRequestSchema.parse(raw);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  const problem = validateFileMeta(input.fileName, input.mimeType, input.sizeBytes);
  if (problem) throw new BadRequestError(problem);
  if ((input.shareWithClient || input.isDeliverable) && !isManager(ctx)) {
    throw new ForbiddenError("Only owners and admins can share files with clients.");
  }
  if (input.taskId) {
    const [t] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, input.taskId), eq(tasks.projectId, project.id), isNull(tasks.archivedAt)))
      .limit(1);
    if (!t) throw new BadRequestError("Task does not belong to this project.");
  }
  if (input.milestoneId) {
    const [m] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.id, input.milestoneId), eq(milestones.projectId, project.id), isNull(milestones.deletedAt)))
      .limit(1);
    if (!m) throw new BadRequestError("Milestone does not belong to this project.");
  }

  const storagePath = `${ctx.orgId}/${project.id}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const isDeliverable = input.isDeliverable;
  const [row] = await db
    .insert(attachments)
    .values({
      organizationId: ctx.orgId,
      projectId: project.id,
      taskId: input.taskId || null,
      milestoneId: input.milestoneId || null,
      uploadedById: ctx.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath,
      visibility: input.shareWithClient || isDeliverable ? "CLIENT" : "INTERNAL",
      isDeliverable,
      status: "PENDING",
    })
    .returning({ id: attachments.id });
  const signed = await storage.createSignedUploadUrl(storagePath);
  return { attachmentId: row!.id, path: signed.path, token: signed.token };
}

/** Step 2: verify the object really exists in storage with the declared size, then publish it. */
export async function completeUpload(db: Database, storage: StorageAdapter, ctx: AuthContext, attachmentId: string) {
  assertStaff(ctx);
  const [file] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.organizationId, ctx.orgId),
        eq(attachments.uploadedById, ctx.userId),
        eq(attachments.status, "PENDING"),
        isNull(attachments.deletedAt),
      ),
    )
    .limit(1);
  if (!file) throw new NotFoundError("Upload not found.");
  const project = await getAccessibleProject(db, ctx, file.projectId);
  const size = await storage.objectSize(file.storagePath);
  if (size === null) throw new BadRequestError("The upload did not finish. Please try again.");
  if (size !== file.sizeBytes) {
    await storage.remove([file.storagePath]);
    await db.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, file.id));
    throw new BadRequestError("The uploaded file didn't match what was declared.");
  }
  await db.transaction(async (tx) => {
    await tx.update(attachments).set({ status: "READY" }).where(eq(attachments.id, file.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "file",
      entityId: file.id,
      projectId: project.id,
      action: file.isDeliverable ? "deliverable_shared" : "uploaded",
      summary: `${ctx.fullName} ${file.isDeliverable ? "shared deliverable" : "uploaded"} ${file.fileName}`,
      clientVisible: file.visibility === "CLIENT",
    });
  });
  if (file.visibility === "CLIENT") {
    await notify(db, {
      orgId: ctx.orgId,
      userIds: await clientUserIds(db, ctx.orgId, project.clientId),
      actorId: ctx.userId,
      type: "file_shared",
      title: file.isDeliverable ? `New deliverable: ${file.fileName}` : `New file shared: ${file.fileName}`,
      body: `A file was shared with you on ${project.name}.`,
      link: `/portal/projects/${project.id}/${file.isDeliverable ? "deliverables" : "files"}`,
      dedupeKey: `file-shared:${file.id}`,
    });
  }
}

/** Loads a file the current user is allowed to see. Other orgs/clients get "not found". */
async function getAccessibleFile(db: DbOrTx, ctx: AuthContext, attachmentId: string) {
  const [file] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.organizationId, ctx.orgId),
        eq(attachments.status, "READY"),
        isNull(attachments.deletedAt),
      ),
    )
    .limit(1);
  if (!file) throw new NotFoundError("File not found.");
  await getAccessibleProject(db, ctx, file.projectId, { allowClient: true });
  if (isClient(ctx) && file.visibility !== "CLIENT") throw new NotFoundError("File not found.");
  return file;
}

/** Short-lived signed download URL, issued only after the access check. */
export async function getDownloadUrl(db: DbOrTx, storage: StorageAdapter, ctx: AuthContext, attachmentId: string) {
  const file = await getAccessibleFile(db, ctx, attachmentId);
  return storage.createSignedDownloadUrl(file.storagePath, DOWNLOAD_URL_TTL_SECONDS, file.fileName);
}

export async function deleteAttachment(db: Database, storage: StorageAdapter, ctx: AuthContext, attachmentId: string) {
  assertStaff(ctx);
  const file = await getAccessibleFile(db, ctx, attachmentId);
  if (!isManager(ctx) && file.uploadedById !== ctx.userId) throw new ForbiddenError("You can only delete files you uploaded.");
  await db.transaction(async (tx) => {
    await tx.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, file.id));
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "file",
      entityId: file.id,
      projectId: file.projectId,
      action: "deleted",
      summary: `${ctx.fullName} deleted ${file.fileName}`,
    });
  });
  await storage.remove([file.storagePath]);
}

export async function listProjectFiles(
  db: DbOrTx,
  ctx: AuthContext,
  projectId: string,
  { taskId, deliverablesOnly = false }: { taskId?: string; deliverablesOnly?: boolean } = {},
) {
  const project = await getAccessibleProject(db, ctx, projectId, { allowClient: true });
  return db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      visibility: attachments.visibility,
      isDeliverable: attachments.isDeliverable,
      taskId: attachments.taskId,
      milestoneId: attachments.milestoneId,
      createdAt: attachments.createdAt,
      uploadedById: attachments.uploadedById,
      uploadedByName: users.fullName,
    })
    .from(attachments)
    .leftJoin(users, eq(users.id, attachments.uploadedById))
    .where(
      and(
        eq(attachments.projectId, project.id),
        eq(attachments.status, "READY"),
        isNull(attachments.deletedAt),
        isClient(ctx) ? eq(attachments.visibility, "CLIENT") : undefined,
        taskId ? eq(attachments.taskId, taskId) : undefined,
        deliverablesOnly ? eq(attachments.isDeliverable, true) : undefined,
      ),
    )
    .orderBy(desc(attachments.createdAt))
    .limit(300);
}
