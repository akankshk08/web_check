import type { Metadata } from "next";
import { monthRange, MonthCalendar, parseMonth } from "@/components/shared/month-calendar";
import { PageHeader } from "@/components/shared/page";
import { getDb } from "@/db";
import { requireStaffPage } from "@/server/auth/session";
import { sp } from "@/server/page";
import { getCalendarEvents } from "@/server/services/calendar";

export const metadata: Metadata = { title: "My calendar" };

export default async function MyCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage();
  const m = parseMonth(sp((await searchParams).month));
  const { from, to } = monthRange(m);
  const events = await getCalendarEvents(getDb(), ctx, from, to, "mine");
  return (
    <>
      <PageHeader title="My calendar" description="Your task deadlines and milestones on your projects." />
      <MonthCalendar year={m.year} month={m.month} events={events} basePath="/app/my-work/calendar" />
    </>
  );
}
