import { ActivityFeed } from "@/components/projects/activity-feed";
import { Pagination } from "@/components/shared/pagination";
import { Card } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound, pageNumber, sp } from "@/server/page";
import { listProjectActivity } from "@/server/services/activity";

export default async function ProjectActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const page = pageNumber(sp((await searchParams).page));
  const data = await orNotFound(listProjectActivity(getDb(), ctx, id, page));
  return (
    <Card>
      <ActivityFeed rows={data.rows} />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath={`/app/projects/${id}/activity`} params={{}} />
    </Card>
  );
}
