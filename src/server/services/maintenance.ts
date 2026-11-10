import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database, DbOrTx } from "@/db";
import { clients, maintenanceRecords, projectDeliveries, projects, users } from "@/db/schema";
import { nn } from "@/lib/validations/common";
import type { deliverySchema, maintenanceSchema } from "@/lib/validations/entities";
import { assertManager } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/types";
import { NotFoundError } from "@/server/errors";
import { getAccessibleProject } from "./access";
import { logActivity } from "./activity";

/** Delivered websites: delivery details plus maintenance counts (manually entered data only). */
export async function listDeliveries(db: DbOrTx, ctx: AuthContext) {
  assertManager(ctx);
  return db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      projectStatus: projects.status,
      clientName: sql<string>`coalesce(${clients.companyName}, ${clients.name})`,
      productionUrl: projectDeliveries.productionUrl,
      hostingProvider: projectDeliveries.hostingProvider,
      domainExpiry: projectDeliveries.domainExpiry,
      sslExpiry: projectDeliveries.sslExpiry,
      deployedOn: projectDeliveries.deployedOn,
      openMaintenance: sql<number>`(select count(*)::int from maintenance_records m where m.project_id = ${projects.id} and m.status in ('SCHEDULED','IN_PROGRESS'))`,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(projectDeliveries, eq(projectDeliveries.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, ctx.orgId),
        isNull(projects.archivedAt),
        sql`(${projects.status} = 'COMPLETED' or ${projectDeliveries.id} is not null or ${projects.type} = 'MAINTENANCE')`,
      ),
    )
    .orderBy(sql`${projectDeliveries.domainExpiry} asc nulls last`, projects.name)
    .limit(300);
}

export async function getDelivery(db: DbOrTx, ctx: AuthContext, projectId: string) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, projectId);
  const [delivery] = await db.select().from(projectDeliveries).where(eq(projectDeliveries.projectId, project.id)).limit(1);
  const records = await db
    .select({
      id: maintenanceRecords.id,
      type: maintenanceRecords.type,
      title: maintenanceRecords.title,
      description: maintenanceRecords.description,
      status: maintenanceRecords.status,
      scheduledFor: maintenanceRecords.scheduledFor,
      completedOn: maintenanceRecords.completedOn,
      hours: maintenanceRecords.hours,
      performedByName: users.fullName,
    })
    .from(maintenanceRecords)
    .leftJoin(users, eq(users.id, maintenanceRecords.performedById))
    .where(eq(maintenanceRecords.projectId, project.id))
    .orderBy(desc(sql`coalesce(${maintenanceRecords.completedOn}, ${maintenanceRecords.scheduledFor})`), desc(maintenanceRecords.createdAt))
    .limit(200);
  return { project, delivery: delivery ?? null, records };
}

export async function upsertDelivery(db: Database, ctx: AuthContext, input: z.infer<typeof deliverySchema>) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  const values = {
    productionUrl: nn(input.productionUrl),
    hostingProvider: nn(input.hostingProvider),
    domainProvider: nn(input.domainProvider),
    domainExpiry: nn(input.domainExpiry),
    sslExpiry: nn(input.sslExpiry),
    deployedOn: nn(input.deployedOn),
    handoverNotes: nn(input.handoverNotes),
    updatedById: ctx.userId,
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(projectDeliveries)
      .values({ ...values, organizationId: ctx.orgId, projectId: project.id })
      .onConflictDoUpdate({ target: projectDeliveries.projectId, set: values });
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "delivery",
      entityId: project.id,
      projectId: project.id,
      action: "updated",
      summary: `${ctx.fullName} updated delivery details for ${project.name}`,
    });
  });
}

function recordValues(input: z.infer<typeof maintenanceSchema>, ctx: AuthContext) {
  return {
    type: input.type,
    title: input.title,
    description: nn(input.description),
    status: input.status,
    scheduledFor: nn(input.scheduledFor),
    completedOn: input.status === "COMPLETED" ? (nn(input.completedOn) ?? new Date().toISOString().slice(0, 10)) : nn(input.completedOn),
    hours: nn(input.hours),
    performedById: ctx.userId,
  };
}

export async function createMaintenanceRecord(db: Database, ctx: AuthContext, input: z.infer<typeof maintenanceSchema>) {
  assertManager(ctx);
  const project = await getAccessibleProject(db, ctx, input.projectId);
  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(maintenanceRecords)
      .values({ ...recordValues(input, ctx), organizationId: ctx.orgId, projectId: project.id })
      .returning({ id: maintenanceRecords.id });
    await logActivity(tx, {
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: "maintenance",
      entityId: r!.id,
      projectId: project.id,
      action: "created",
      summary: `${ctx.fullName} logged maintenance: ${input.title}`,
    });
  });
}

export async function updateMaintenanceRecord(db: Database, ctx: AuthContext, id: string, input: z.infer<typeof maintenanceSchema>) {
  assertManager(ctx);
  const rows = await db
    .update(maintenanceRecords)
    .set(recordValues(input, ctx))
    .where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.organizationId, ctx.orgId), eq(maintenanceRecords.projectId, input.projectId)))
    .returning({ id: maintenanceRecords.id });
  if (rows.length === 0) throw new NotFoundError("Maintenance record not found.");
}

export async function deleteMaintenanceRecord(db: Database, ctx: AuthContext, id: string) {
  assertManager(ctx);
  const rows = await db
    .delete(maintenanceRecords)
    .where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.organizationId, ctx.orgId)))
    .returning({ id: maintenanceRecords.id });
  if (rows.length === 0) throw new NotFoundError("Maintenance record not found.");
}
