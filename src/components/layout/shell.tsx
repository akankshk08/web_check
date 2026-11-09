import type * as React from "react";
import { getDb } from "@/db";
import type { AuthContext } from "@/server/auth/types";
import { unreadNotificationCount } from "@/server/services/notifications";
import { AppHeader } from "./header";
import type { NavSection } from "./nav-config";
import { Sidebar } from "./sidebar";

export async function AppShell({
  ctx,
  nav,
  homeHref,
  notificationsHref,
  settingsHref,
  children,
}: {
  ctx: AuthContext;
  nav: NavSection[];
  homeHref: string;
  notificationsHref: string;
  settingsHref: string;
  children: React.ReactNode;
}) {
  const unread = await unreadNotificationCount(getDb(), ctx);
  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar sections={nav} orgName={ctx.orgName} homeHref={homeHref} />
      <div className="lg:pl-60">
        <AppHeader
          user={{ fullName: ctx.fullName, email: ctx.email, role: ctx.role }}
          memberships={ctx.memberships}
          activeOrgId={ctx.orgId}
          unread={unread}
          notificationsHref={notificationsHref}
          settingsHref={settingsHref}
        />
        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
