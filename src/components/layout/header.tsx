"use client";
import { Bell, Building2, Check, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import type { Membership } from "@/server/auth/types";
import { switchOrganizationAction } from "@/server/actions/auth";
import { humanize } from "@/lib/utils";

export function AppHeader({
  user,
  memberships,
  activeOrgId,
  unread,
  notificationsHref,
  settingsHref,
}: {
  user: { fullName: string; email: string; role: string };
  memberships: Membership[];
  activeOrgId: string;
  unread: number;
  notificationsHref: string;
  settingsHref: string;
}) {
  const router = useRouter();
  const switchOrg = async (orgId: string) => {
    const res = await switchOrganizationAction({ orgId });
    if (!res.ok) return void toast.error(res.error);
    router.push(res.data.redirectTo);
    router.refresh();
  };
  const signOut = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
      {memberships.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="mr-auto ml-12 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium hover:bg-subtle lg:ml-0">
            <Building2 className="size-4 text-muted" aria-hidden />
            <span className="max-w-[160px] truncate">{memberships.find((m) => m.orgId === activeOrgId)?.orgName}</span>
            <ChevronDown className="size-3.5 text-muted" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem key={m.orgId} onSelect={() => m.orgId !== activeOrgId && switchOrg(m.orgId)}>
                <span className="flex-1 truncate">{m.orgName}</span>
                <span className="text-[11px] text-muted">{humanize(m.role)}</span>
                {m.orgId === activeOrgId && <Check className="!text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Link
        href={notificationsHref}
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md py-1 pr-2 pl-1 hover:bg-subtle" aria-label="Account menu">
          <Avatar name={user.fullName} size={28} />
          <span className="hidden text-[13px] font-medium sm:inline">{user.fullName}</span>
          <ChevronDown className="size-3.5 text-muted" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">{user.fullName}</span>
            <span className="block truncate">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={signOut}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
