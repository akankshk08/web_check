import { agencyNav } from "@/components/layout/nav-config";
import { AppShell } from "@/components/layout/shell";
import { canManageFinance, homePathFor } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  return (
    <AppShell
      ctx={ctx}
      nav={agencyNav(ctx.role, canManageFinance(ctx))}
      homeHref={homePathFor(ctx.role)}
      notificationsHref="/app/notifications"
      settingsHref="/app/settings"
    >
      {children}
    </AppShell>
  );
}
