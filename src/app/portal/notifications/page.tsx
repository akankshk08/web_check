import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireClientPage } from "@/server/auth/session";
import { pageNumber, sp } from "@/server/page";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function PortalNotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireClientPage();
  const data = await listNotifications(getDb(), ctx, { page: pageNumber(sp((await searchParams).page)) });
  return (
    <>
      <PageHeader title="Notifications" />
      <Card>
        <NotificationList rows={data.rows} />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/portal/notifications" params={{}} />
      </Card>
    </>
  );
}
