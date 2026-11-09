import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database, DbOrTx } from "@/db";
import { projectComments, users } from "@/db/schema";
import type { Visibility } from "@/db/schema/enums";
import { isClient } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";
import { clientUserIds } from "./clients";
import { notify } from "./notifications";
import { managerUserIds, projectMemberIds } from "./projects";

/** Project discussion. Clients only ever receive CLIENT-visible messages. */
export async function listProjectComments(db: DbOrTx, ctx: AuthContext, projectId: string) {
  const project = await getAccessibleProject(db, ctx, projectId, { allowClient: true });
  return db
    .select({
      id: projectComments.id,
      body: projectComments.body,
      visibility: projectComments.visibility,
      createdAt: projectComments.createdAt,
      authorId: users.id,
      authorName: users.fullName,
    })
    .from(projectComments)
    .leftJoin(users, eq(users.id, projectComments.authorId))
    .where(
      and(
        eq(projectComments.projectId, project.id),
        isNull(projectComments.deletedAt),
        isClient(ctx) ? eq(projectComments.visibility, "CLIENT") : undefined,
      ),
    )
    .orderBy(asc(projectComments.createdAt))
    .limit(300);
}

export async function addProjectComment(
  db: Database,
  ctx: AuthContext,
  input: { projectId: string; body: string; visibility: Visibility },
) {
  const project = await getAccessibleProject(db, ctx, input.projectId, { allowClient: true });
  // Client messages are always part of the shared discussion.
  const visibility: Visibility = isClient(ctx) ? "CLIENT" : input.visibility;
  const comment = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(projectComments)
      .values({ organizationId: ctx.orgId, projectId: project.id, authorId: ctx.userId, body: input.body, visibility })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "comment",
      entityId: c!.id,
      projectId: project.id,
      action: "project_comment",
      summary: `${ctx.fullName} posted in ${project.name}${visibility === "INTERNAL" ? " (internal)" : ""}`,
      clientVisible: visibility === "CLIENT",
    });
    return c!;
  });

  const base = {
    orgId: ctx.orgId,
    actorId: ctx.userId,
    type: "comment",
    title: `New message in ${project.name}`,
    body: `${ctx.fullName}: ${input.body.slice(0, 200)}`,
    dedupeKey: `project-comment:${comment.id}`,
  };
  await notify(db, {
    ...base,
    userIds: [...(await projectMemberIds(db, project.id)), ...(await managerUserIds(db, ctx.orgId))],
    link: `/app/projects/${project.id}`,
  });
  if (visibility === "CLIENT") {
    await notify(db, { ...base, userIds: await clientUserIds(db, ctx.orgId, project.clientId), link: `/portal/projects/${project.id}` });
  }
  return comment;
}
