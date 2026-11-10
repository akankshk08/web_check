import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { monthRange, MonthCalendar, parseMonth } from "@/components/shared/month-calendar";
import { PageHeader } from "@/components/shared/page";
import { getDb } from "@/db";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { sp } from "@/server/page";
import { getCalendarEvents } from "@/server/services/calendar";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  if (!isManager(ctx)) redirect("/app/my-work/calendar");
  const m = parseMonth(sp((await searchParams).month));
  const { from, to } = monthRange(m);
  const events = await getCalendarEvents(getDb(), ctx, from, to, "org");
  return (
    <>
      <PageHeader title="Calendar" description="Task, milestone and project deadlines across the workspace." />
      <MonthCalendar year={m.year} month={m.month} events={events} basePath="/app/calendar" />
    </>
  );
}
