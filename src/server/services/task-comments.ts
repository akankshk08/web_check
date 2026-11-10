import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { taskComments } from "@/db/schema";
import type { AuthContext } from "@/server/auth/types";
import { logActivity } from "./activity";
import { notify } from "./notifications";
import { getAccessibleTask } from "./tasks";

export async function addTaskComment(db: Database, ctx: AuthContext, input: { taskId: string; body: string }) {
  const { task, project } = await getAccessibleTask(db, ctx, input.taskId);
  const comment = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(taskComments)
      .values({ organizationId: ctx.orgId, taskId: task.id, authorId: ctx.userId, body: input.body })
      .returning();
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "comment",
      entityId: c!.id,
      projectId: project.id,
      action: "task_comment",
      summary: `${ctx.fullName} commented on "${task.title}"`,
    });
    return c!;
  });
  const previous = await db
    .selectDistinct({ authorId: taskComments.authorId })
    .from(taskComments)
    .where(eq(taskComments.taskId, task.id));
  await notify(db, {
    orgId: ctx.orgId,
    userIds: [task.assigneeId, task.createdById, ...previous.map((p) => p.authorId)].filter((x): x is string => !!x),
    actorId: ctx.userId,
    type: "comment",
    title: `New comment on ${task.title}`,
    body: input.body.slice(0, 200),
    link: `/app/projects/${project.id}/tasks?task=${task.id}`,
    dedupeKey: `task-comment:${comment.id}`,
  });
  return comment;
}
