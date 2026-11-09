"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { changeRequestSchema, milestoneDecisionSchema, milestoneSchema, updateMilestoneSchema } from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import {
  addMilestoneFeedback,
  approveMilestone,
  createMilestone,
  deleteMilestone,
  requestMilestoneChanges,
  submitMilestoneForReview,
  updateMilestone,
} from "@/server/services/milestones";

function revalidateMilestones() {
  revalidatePath("/app/projects", "layout");
  revalidatePath("/portal", "layout");
}

export const createMilestoneAction = authedAction(milestoneSchema, async (input, ctx) => {
  const m = await createMilestone(getDb(), ctx, input);
  revalidateMilestones();
  return { id: m.id };
});
export const updateMilestoneAction = authedAction(updateMilestoneSchema, async (input, ctx) => {
  await updateMilestone(getDb(), ctx, input);
  revalidateMilestones();
  return null;
});
export const deleteMilestoneAction = authedAction(z.object({ id: z.uuid() }).strict(), async (input, ctx) => {
  await deleteMilestone(getDb(), ctx, input.id);
  revalidateMilestones();
  return null;
});
export const submitMilestoneAction = authedAction(milestoneDecisionSchema, async (input, ctx) => {
  await submitMilestoneForReview(getDb(), ctx, input);
  revalidateMilestones();
  return null;
});
export const approveMilestoneAction = authedAction(milestoneDecisionSchema, async (input, ctx) => {
  await approveMilestone(getDb(), ctx, input);
  revalidateMilestones();
  return null;
});
export const requestChangesAction = authedAction(changeRequestSchema, async (input, ctx) => {
  await requestMilestoneChanges(getDb(), ctx, input);
  revalidateMilestones();
  return null;
});
export const milestoneFeedbackAction = authedAction(changeRequestSchema, async (input, ctx) => {
  await addMilestoneFeedback(getDb(), ctx, input);
  revalidateMilestones();
  return null;
});
