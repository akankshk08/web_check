"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { clientSchema, inviteClientSchema, updateClientSchema } from "@/lib/validations/entities";
import { authedAction } from "@/server/action";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { createClient, removeClientUser, setClientArchived, updateClient } from "@/server/services/clients";
import { createInvitation, revokeInvitation } from "@/server/services/invitations";

const idSchema = z.object({ id: z.uuid() }).strict();

export const createClientAction = authedAction(clientSchema, async (input, ctx) => {
  const client = await createClient(getDb(), ctx, input);
  revalidatePath("/app/clients");
  return { id: client.id };
});

export const updateClientAction = authedAction(updateClientSchema, async ({ id, ...input }, ctx) => {
  await updateClient(getDb(), ctx, id, input);
  revalidatePath(`/app/clients/${id}`);
  revalidatePath("/app/clients");
  return null;
});

export const archiveClientAction = authedAction(idSchema.extend({ archived: z.boolean() }).strict(), async (input, ctx) => {
  await setClientArchived(getDb(), ctx, input.id, input.archived);
  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${input.id}`);
  return null;
});

export const inviteClientUserAction = authedAction(inviteClientSchema, async (input, ctx) => {
  const db = getDb();
  await enforceRateLimit(db, `invite:${ctx.orgId}`, RATE_LIMITS.invite.limit, RATE_LIMITS.invite.window);
  const { url } = await createInvitation(db, ctx, { email: input.email, role: "CLIENT", clientId: input.clientId });
  revalidatePath(`/app/clients/${input.clientId}`);
  return { url };
});

export const removeClientUserAction = authedAction(idSchema, async (input, ctx) => {
  await removeClientUser(getDb(), ctx, input.id);
  revalidatePath("/app/clients", "layout");
  return null;
});

export const revokeInvitationAction = authedAction(idSchema, async (input, ctx) => {
  await revokeInvitation(getDb(), ctx, input.id);
  revalidatePath("/app/team");
  revalidatePath("/app/clients", "layout");
  return null;
});
