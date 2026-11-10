import { z } from "zod";
import { getDb } from "@/db";
import { serverEnv } from "@/lib/server-env";
import { isManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { NotFoundError } from "@/server/errors";
import { listProjectFiles } from "@/server/services/files";
import { listMilestoneOptions } from "@/server/services/milestones";
import { getTaskDetail } from "@/server/services/tasks";
import { listStaffOptions } from "@/server/services/team";
import { TaskDrawer } from "./task-drawer";

/** Server-loads the task opened via ?task=<id>. Silently renders nothing if it isn't accessible. */
export async function TaskDrawerLoader({ ctx, taskId }: { ctx: AuthContext; taskId: string | undefined }) {
  if (!taskId || !z.uuid().safeParse(taskId).success) return null;
  const db = getDb();
  let data;
  try {
    const detail = await getTaskDetail(db, ctx, taskId);
    const [files, milestones, staff] = await Promise.all([
      listProjectFiles(db, ctx, detail.task.projectId, { taskId }),
      listMilestoneOptions(db, ctx, detail.task.projectId),
      isManager(ctx) ? listStaffOptions(db, ctx) : Promise.resolve([]),
    ]);
    data = { detail, files, milestones, staff };
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
  const { detail, files, milestones, staff } = data;
  return (
      <TaskDrawer
        detail={detail}
        files={files.map((f) => ({ ...f, canDelete: isManager(ctx) || f.uploadedById === ctx.userId }))}
        options={{ milestones, staff }}
        currentUserId={ctx.userId}
        isManager={isManager(ctx)}
        bucket={serverEnv().SUPABASE_STORAGE_BUCKET}
      />
  );
}
