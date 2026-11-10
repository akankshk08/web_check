import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { projectMembers, projects } from "@/db/schema";
import { isClient, isManager, isStaff } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { NotFoundError } from "@/server/errors";

export type ProjectRow = typeof projects.$inferSelect;

/**
 * Loads a project the current user may access, or throws NotFound.
 *  - Owners/admins: any project in their organization.
 *  - Employees: only projects they are a member of.
 *  - Clients (when allowClient): only non-archived projects of their own client account(s).
 * Projects in other organizations are always "not found".
 */
export async function getAccessibleProject(
  db: DbOrTx,
  ctx: AuthContext,
  projectId: string,
  { allowClient = false, includeArchived = false } = {},
): Promise<ProjectRow> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, ctx.orgId)))
    .limit(1);
  if (!project) throw new NotFoundError("Project not found.");

  if (isManager(ctx)) {
    if (project.archivedAt && !includeArchived) throw new NotFoundError("Project not found.");
    return project;
  }
  if (project.archivedAt) throw new NotFoundError("Project not found.");

  if (isStaff(ctx)) {
    if (await isProjectMember(db, project.id, ctx.userId)) return project;
    throw new NotFoundError("Project not found.");
  }
  if (allowClient && isClient(ctx) && ctx.clientIds.includes(project.clientId)) return project;
  throw new NotFoundError("Project not found.");
}

export async function isProjectMember(db: DbOrTx, projectId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return !!row;
}

/** Project ids an employee is assigned to (non-archived). */
export async function memberProjectIds(db: DbOrTx, ctx: AuthContext): Promise<string[]> {
  const rows = await db
    .select({ id: projects.id })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.userId, ctx.userId), eq(projects.organizationId, ctx.orgId), isNull(projects.archivedAt)));
  return rows.map((r) => r.id);
}
