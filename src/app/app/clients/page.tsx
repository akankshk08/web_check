import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { FilterBar } from "@/components/shared/filters";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { clientStatusEnum } from "@/db/schema/enums";
import { formatDate } from "@/lib/dates";
import { requireManagerPage } from "@/server/auth/session";
import { pageNumber, pickEnum, sp } from "@/server/page";
import { listClients } from "@/server/services/clients";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireManagerPage();
  const params = await searchParams;
  const q = sp(params.q) ?? "";
  const status = pickEnum(sp(params.status), clientStatusEnum.enumValues);
  const archived = sp(params.view) === "archived";
  const page = pageNumber(sp(params.page));
  const data = await listClients(getDb(), ctx, { q, status, archived, page });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Companies and people you do work for."
        actions={
          <Button asChild>
            <Link href="/app/clients/new">
              <Plus /> New client
            </Link>
          </Button>
        }
      />
      <Card>
        <div className="border-b border-border p-3">
          <FilterBar
            searchPlaceholder="Search name, email or company"
            filters={[
              { name: "status", label: "All statuses", options: [...clientStatusEnum.enumValues] },
              { name: "view", label: "Active clients", options: [{ value: "archived", label: "Archived clients" }] },
            ]}
          />
        </div>
        {data.rows.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={q || status || archived ? "No clients match your filters" : "No clients yet"}
            description={q || status || archived ? "Try a different search or filter." : "Add your first client to start creating projects for them."}
            action={
              !q && !status && !archived ? (
                <Button asChild size="sm">
                  <Link href="/app/clients/new">Add client</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Client</TH>
                <TH>Email</TH>
                <TH>Status</TH>
                <TH className="text-right">Projects</TH>
                <TH>Added</TH>
              </tr>
            </THead>
            <TBody>
              {data.rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">
                      {c.companyName ?? c.name}
                    </Link>
                    {c.companyName && <p className="text-xs text-muted">{c.name}</p>}
                  </TD>
                  <TD className="text-muted">{c.email}</TD>
                  <TD>{c.archivedAt ? <StatusBadge status="CANCELLED" /> : <StatusBadge status={c.status} />}</TD>
                  <TD className="text-right tabular-nums">{c.projectCount}</TD>
                  <TD className="text-muted">{formatDate(c.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/app/clients" params={{ q, status, view: archived ? "archived" : undefined }} />
      </Card>
    </>
  );
}
