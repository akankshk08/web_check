import type { OrgRole } from "@/db/schema/enums";

export type NavIcon =
  | "dashboard"
  | "projects"
  | "clients"
  | "team"
  | "calendar"
  | "invoices"
  | "reports"
  | "maintenance"
  | "support"
  | "tasks"
  | "timesheets"
  | "notifications"
  | "settings"
  | "milestones"
  | "files"
  | "profile";

export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

export function agencyNav(role: OrgRole, canFinance: boolean): NavSection[] {
  if (role === "EMPLOYEE") {
    return [
      {
        items: [
          { href: "/app/my-work", label: "My work", icon: "dashboard", exact: true },
          { href: "/app/my-work/tasks", label: "My tasks", icon: "tasks" },
          { href: "/app/my-work/projects", label: "My projects", icon: "projects" },
          { href: "/app/my-work/calendar", label: "Calendar", icon: "calendar" },
          { href: "/app/my-work/timesheets", label: "Timesheets", icon: "timesheets" },
        ],
      },
      {
        title: "Workspace",
        items: [
          { href: "/app/team", label: "Team", icon: "team" },
          { href: "/app/notifications", label: "Notifications", icon: "notifications" },
          { href: "/app/settings", label: "Settings", icon: "settings" },
        ],
      },
    ];
  }
  return [
    {
      items: [
        { href: "/app", label: "Dashboard", icon: "dashboard", exact: true },
        { href: "/app/projects", label: "Projects", icon: "projects" },
        { href: "/app/clients", label: "Clients", icon: "clients" },
        { href: "/app/team", label: "Team", icon: "team" },
        { href: "/app/calendar", label: "Calendar", icon: "calendar" },
      ],
    },
    {
      title: "Business",
      items: [
        ...(canFinance ? [{ href: "/app/invoices", label: "Invoices", icon: "invoices" as const }] : []),
        { href: "/app/reports", label: "Reports", icon: "reports" },
        { href: "/app/maintenance", label: "Maintenance", icon: "maintenance" },
        { href: "/app/support", label: "Support tickets", icon: "support" },
      ],
    },
    {
      title: "Me",
      items: [
        { href: "/app/my-work", label: "My work", icon: "tasks" },
        { href: "/app/my-work/timesheets", label: "Timesheets", icon: "timesheets" },
        { href: "/app/notifications", label: "Notifications", icon: "notifications" },
        { href: "/app/settings", label: "Settings", icon: "settings" },
      ],
    },
  ];
}

export const portalNav: NavSection[] = [
  {
    items: [
      { href: "/portal", label: "Overview", icon: "dashboard", exact: true },
      { href: "/portal/projects", label: "Projects", icon: "projects" },
      { href: "/portal/invoices", label: "Invoices", icon: "invoices" },
      { href: "/portal/support", label: "Support", icon: "support" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/portal/notifications", label: "Notifications", icon: "notifications" },
      { href: "/portal/profile", label: "Profile", icon: "profile" },
    ],
  },
];
