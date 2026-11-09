"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { authedAction } from "@/server/action";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { completeUpload, deleteAttachment, requestUpload, uploadRequestSchema } from "@/server/services/files";
import { supabaseStorage } from "@/server/storage";

export const requestUploadAction = authedAction(uploadRequestSchema, async (input, ctx) => {
  const db = getDb();
  await enforceRateLimit(db, `upload:${ctx.userId}`, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.window);
  return requestUpload(db, supabaseStorage(), ctx, input);
});

export const completeUploadAction = authedAction(z.object({ attachmentId: z.uuid() }).strict(), async (input, ctx) => {
  await completeUpload(getDb(), supabaseStorage(), ctx, input.attachmentId);
  revalidatePath("/app/projects", "layout");
  revalidatePath("/portal", "layout");
  return null;
});

export const deleteAttachmentAction = authedAction(z.object({ id: z.uuid() }).strict(), async (input, ctx) => {
  await deleteAttachment(getDb(), supabaseStorage(), ctx, input.id);
  revalidatePath("/app/projects", "layout");
  revalidatePath("/portal", "layout");
  return null;
});
