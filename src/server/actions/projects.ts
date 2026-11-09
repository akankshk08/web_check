"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { projectCommentSchema, projectSchema, updateProjectSchema } from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import { addProjectComment } from "@/server/services/comments";
import { createProject, setProjectArchived, updateProject } from "@/server/services/projects";

export const createProjectAction = authedAction(projectSchema, async (input, ctx) => {
  const project = await createProject(getDb(), ctx, input);
  revalidatePath("/app/projects");
  return { id: project.id };
});

export const updateProjectAction = authedAction(updateProjectSchema, async ({ id, ...input }, ctx) => {
  await updateProject(getDb(), ctx, id, input);
  revalidatePath(`/app/projects/${id}`, "layout");
  revalidatePath("/app/projects");
  return null;
});

export const archiveProjectAction = authedAction(z.object({ id: z.uuid(), archived: z.boolean() }).strict(), async (input, ctx) => {
  await setProjectArchived(getDb(), ctx, input.id, input.archived);
  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${input.id}`, "layout");
  return null;
});

export const addProjectCommentAction = authedAction(projectCommentSchema, async (input, ctx) => {
  await addProjectComment(getDb(), ctx, input);
  revalidatePath(`/app/projects/${input.projectId}`);
  revalidatePath(`/portal/projects/${input.projectId}`);
  return null;
});
