import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { projects, tasks } from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/dates";
import { notify } from "./notifications";

/**
 * Daily job: remind assignees about tasks due within 2 days.
 * The dedupe key (task + due date) guarantees one reminder per deadline, even if the job reruns.
 */
export async function sendDeadlineReminders(db: DbOrTx) {
  const due = await db
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, assigneeId: tasks.assigneeId, orgId: tasks.organizationId, projectId: tasks.projectId })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        isNotNull(tasks.assigneeId),
        isNull(tasks.archivedAt),
        isNull(projects.archivedAt),
        inArray(tasks.status, ["TODO", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED"]),
        sql`${tasks.dueDate} between ${todayISO()} and ${addDaysISO(2)}`,
      ),
    )
    .limit(5000);

  let sent = 0;
  for (const t of due) {
    const created = await notify(db, {
      orgId: t.orgId,
      userIds: [t.assigneeId!],
      type: "task_due",
      title: `Due soon: ${t.title}`,
      body: `This task is due on ${t.dueDate}.`,
      link: `/app/projects/${t.projectId}/tasks?task=${t.id}`,
      dedupeKey: `task-due:${t.id}:${t.dueDate}`,
      email: true,
    });
    sent += created.length;
  }
  return sent;
}
