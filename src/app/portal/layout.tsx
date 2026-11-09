import { portalNav } from "@/components/layout/nav-config";
import { AppShell } from "@/components/layout/shell";
import { requireClientPage } from "@/server/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireClientPage();
  return (
    <AppShell ctx={ctx} nav={portalNav} homeHref="/portal" notificationsHref="/portal/notifications" settingsHref="/portal/profile">
      {children}
    </AppShell>
  );
}
