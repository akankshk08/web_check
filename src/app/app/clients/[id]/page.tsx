import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, LifeBuoy, Receipt, UserRound } from "lucide-react";
import { ArchiveClientButton, EditClientButton, InviteClientUserForm } from "@/components/clients/client-actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { DetailList, EmptyState, PageHeader } from "@/components/shared/page";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badge";
import { RespondToTicket } from "@/components/support/ticket-respond";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, timeAgo } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { removeClientUserAction, revokeInvitationAction } from "@/server/actions/clients";
import { requireManagerPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { getClient } from "@/server/services/clients";
import { effectiveInvoiceStatus } from "@/server/services/invoices";
import { listPendingInvitations } from "@/server/services/invitations";
import { listTickets } from "@/server/services/support";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireManagerPage();
  const { id } = await params;
  const db = getDb();
  const { client, projects, invoices, portalUsers } = await orNotFound(getClient(db, ctx, id));
  const [invites, tickets] = await Promise.all([listPendingInvitations(db, ctx, { clientId: client.id }), listTickets(db, ctx, { clientId: client.id })]);

  return (
    <>
      <PageHeader
        title={client.companyName ?? client.name}
        description={client.archivedAt ? "This client is archived." : client.email}
        breadcrumbs={[{ href: "/app/clients", label: "Clients" }]}
        actions={
          <>
            <ArchiveClientButton id={client.id} archived={!!client.archivedAt} />
            <EditClientButton
              client={{
                id: client.id,
                name: client.name,
                email: client.email,
                companyName: client.companyName ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                notes: client.notes ?? "",
                status: client.status,
              }}
            />
            {!client.archivedAt && (
              <Button asChild>
                <Link href={`/app/projects/new?clientId=${client.id}`}>New project</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <StatusBadge status={client.status} />
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "Contact", value: client.name },
                  { label: "Email", value: <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a> },
                  { label: "Company", value: client.companyName },
                  { label: "Phone", value: client.phone },
                  { label: "Address", value: client.address },
                  { label: "Client since", value: formatDate(client.createdAt) },
                ]}
              />
              {client.notes && (
                <div className="mt-5 rounded-md border border-warning/30 bg-warning-soft/60 p-3">
                  <p className="text-xs font-medium text-[#8a5a08]">Internal notes</p>
                  <p className="mt-1 text-[13px] whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            {projects.length ? (
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fafbfc]">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <StatusBadge status={p.status} />
                      <div className="hidden w-32 items-center gap-2 sm:flex">
                        <Progress value={p.progress} />
                        <span className="text-xs text-muted tabular-nums">{p.progress}%</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FolderKanban} title="No projects for this client yet" />
            )}
          </Card>

          {invoices && (
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              {invoices.length ? (
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id}>
                      <Link href={`/app/invoices/${i.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fafbfc]">
                        <span className="flex-1 text-sm font-medium">{i.number}</span>
                        <span className="text-xs text-muted">Due {formatDate(i.dueDate)}</span>
                        <StatusBadge status={effectiveInvoiceStatus(i)} />
                        <span className="w-24 text-right text-sm tabular-nums">{formatMoney(i.total, i.currency)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Receipt} title="No invoices yet" />
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
            </CardHeader>
            {tickets.length ? (
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id} className="flex items-start gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.subject}</p>
                      <p className="text-xs text-muted">
                        {t.createdByName} · {timeAgo(t.createdAt)}
                        {t.projectName ? ` · ${t.projectName}` : ""}
                      </p>
                    </div>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <RespondToTicket ticket={t} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={LifeBuoy} title="No support tickets" />
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader>
            <div>
              <CardTitle>Portal access</CardTitle>
              <p className="mt-0.5 text-[13px] text-muted">People who can sign in to this client’s portal.</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {portalUsers.length ? (
              <ul className="flex flex-col gap-3">
                {portalUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <UserRound className="size-4 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.fullName}</p>
                      <p className="truncate text-xs text-muted">
                        {u.email}
                        {u.status !== "ACTIVE" ? " · removed" : ""}
                      </p>
                    </div>
                    <ConfirmButton
                      size="sm"
                      variant="ghost"
                      action={() => removeClientUserAction({ id: u.id })}
                      title="Remove portal access?"
                      description={`${u.fullName} will no longer be able to sign in to this client’s portal.`}
                      confirmLabel="Remove"
                      success="Access removed."
                    >
                      Remove
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">Nobody has portal access yet.</p>
            )}
            {invites.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Pending invitations</p>
                <ul className="flex flex-col gap-2">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{i.email}</span>
                      <span className="text-xs text-muted">expires {formatDate(i.expiresAt)}</span>
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        action={() => revokeInvitationAction({ id: i.id })}
                        title="Cancel invitation?"
                        description="The invitation link will stop working."
                        confirmLabel="Cancel invitation"
                        success="Invitation cancelled."
                      >
                        Revoke
                      </ConfirmButton>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!client.archivedAt && <InviteClientUserForm clientId={client.id} defaultEmail={portalUsers.length ? "" : client.email} />}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
