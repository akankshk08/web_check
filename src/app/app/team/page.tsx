import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { InviteMemberDialog, MemberMenu } from "@/components/team/team-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { revokeInvitationAction } from "@/server/actions/clients";
import { isManager, isOwner } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listPendingInvitations } from "@/server/services/invitations";
import { listTeam } from "@/server/services/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireStaffPage();
  const db = getDb();
  const manager = isManager(ctx);
  const [team, invites] = await Promise.all([listTeam(db, ctx), manager ? listPendingInvitations(db, ctx) : Promise.resolve([])]);
  const staffInvites = invites.filter((i) => i.role !== "CLIENT");

  return (
    <>
      <PageHeader
        title="Team"
        description={`${team.length} member${team.length === 1 ? "" : "s"} in ${ctx.orgName}`}
        actions={manager ? <InviteMemberDialog canInviteAdmins={isOwner(ctx)} /> : undefined}
      />
      <Card>
        {team.length === 0 ? (
          <EmptyState icon={Users} title="No team members" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Role</TH>
                {manager && <TH className="text-right">Active projects</TH>}
                {manager && <TH className="text-right">Open tasks</TH>}
                {manager && <TH className="text-right">Overdue</TH>}
                {manager && <TH className="text-right">Hours (7 days)</TH>}
                <TH className="w-10">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {team.map((m) => (
                <TR key={m.memberId}>
                  <TD>
                    <Link href={`/app/team/${m.memberId}`} className="flex items-center gap-3">
                      <Avatar name={m.fullName} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">{m.fullName}</span>
                        <span className="block truncate text-xs text-muted">{m.jobTitle ?? m.email}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={m.role === "OWNER" ? "primary" : m.role === "ADMIN" ? "info" : "neutral"}>{humanize(m.role)}</Badge>
                      {m.role === "ADMIN" && m.canManageFinances && <Badge tone="success">Finance</Badge>}
                    </div>
                  </TD>
                  {manager && <TD className="text-right tabular-nums">{m.activeProjects}</TD>}
                  {manager && <TD className="text-right tabular-nums">{m.openTasks}</TD>}
                  {manager && <TD className={`text-right tabular-nums ${m.overdueTasks ? "text-danger" : ""}`}>{m.overdueTasks}</TD>}
                  {manager && (
                    <TD className="text-right tabular-nums">
                      {m.hoursLast7Days}
                      <span className="text-muted"> / {m.weeklyCapacityHours}</span>
                    </TD>
                  )}
                  <TD>{manager && <MemberMenu member={m} isOwner={isOwner(ctx)} isSelf={m.userId === ctx.userId} />}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {manager && staffInvites.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border">
            {staffInvites.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium">{i.email}</span>
                <Badge>{humanize(i.role)}</Badge>
                <span className="hidden text-xs text-muted sm:inline">expires {formatDate(i.expiresAt)}</span>
                <ConfirmButton
                  size="sm"
                  variant="ghost"
                  action={() => revokeInvitationAction({ id: i.id })}
                  title="Cancel invitation?"
                  description={`The invitation link sent to ${i.email} will stop working.`}
                  confirmLabel="Cancel invitation"
                  success="Invitation cancelled."
                >
                  Revoke
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
