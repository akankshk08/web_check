"use client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useAction } from "@/components/shared/form";
import { EmptyState } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/business";

type Row = { id: string; title: string; body: string | null; link: string | null; readAt: Date | null; createdAt: Date };

/** Links are always app-relative paths created by the server; anything else is not rendered as a link. */
const safeLink = (link: string | null) => (link && link.startsWith("/") && !link.startsWith("//") ? link : null);

export function NotificationList({ rows }: { rows: Row[] }) {
  const { pending, run } = useAction();
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[13px] text-muted">{unread} unread</p>
        <Button size="sm" variant="secondary" disabled={!unread} loading={pending} onClick={() => run(() => markNotificationsReadAction({ ids: "all" }), { success: "All caught up." })}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="You’ll be notified about assignments, approvals, comments and deadlines." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((n) => {
            const href = safeLink(n.link);
            const content = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px]", !n.readAt && "font-semibold")}>{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                  <span className="block text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span>
                </span>
                {!n.readAt && <span className="sr-only">Unread</span>}
              </>
            );
            return (
              <li key={n.id}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => !n.readAt && void markNotificationsReadAction({ ids: [n.id] })}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-[#fafbfc]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
