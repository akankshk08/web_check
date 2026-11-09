"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { taskCommentSchema, taskSchema, taskStatusSchema, timeEntrySchema, updateTaskSchema } from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import { addTaskComment, archiveTask, createTask, getTaskDetail, updateTask, updateTaskStatus } from "@/server/services/tasks";
import { deleteTimeEntry, logTime } from "@/server/services/timesheets";

function revalidateTaskViews(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`, "layout");
  revalidatePath("/app/my-work", "layout");
}

export const createTaskAction = authedAction(taskSchema, async (input, ctx) => {
  const task = await createTask(getDb(), ctx, input);
  revalidateTaskViews(input.projectId);
  return { id: task.id };
});

export const updateTaskAction = authedAction(updateTaskSchema, async (input, ctx) => {
  await updateTask(getDb(), ctx, input);
  const { task } = await getTaskDetail(getDb(), ctx, input.id);
  revalidateTaskViews(task.projectId);
  return null;
});

export const updateTaskStatusAction = authedAction(taskStatusSchema, async (input, ctx) => {
  await updateTaskStatus(getDb(), ctx, input);
  revalidatePath("/app/my-work", "layout");
  return null;
});

export const archiveTaskAction = authedAction(z.object({ id: z.uuid() }).strict(), async (input, ctx) => {
  const { task } = await getTaskDetail(getDb(), ctx, input.id);
  await archiveTask(getDb(), ctx, input.id);
  revalidateTaskViews(task.projectId);
  return null;
});

export const addTaskCommentAction = authedAction(taskCommentSchema, async (input, ctx) => {
  await addTaskComment(getDb(), ctx, input);
  return null;
});

export const logTimeAction = authedAction(timeEntrySchema, async (input, ctx) => {
  await logTime(getDb(), ctx, input);
  revalidatePath("/app/my-work/timesheets");
  return null;
});

export const deleteTimeEntryAction = authedAction(z.object({ id: z.uuid() }).strict(), async (input, ctx) => {
  await deleteTimeEntry(getDb(), ctx, input.id);
  revalidatePath("/app/my-work/timesheets");
  return null;
});
