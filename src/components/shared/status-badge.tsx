import { Badge, type BadgeTone } from "@/components/ui/badge";
import { humanize } from "@/lib/utils";

const TONES: Record<string, BadgeTone> = {
  // projects
  PLANNING: "info",
  ACTIVE: "primary",
  ON_HOLD: "warning",
  IN_REVIEW: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  // tasks
  TODO: "neutral",
  IN_PROGRESS: "primary",
  CHANGES_REQUESTED: "warning",
  // milestones
  NOT_STARTED: "neutral",
  SUBMITTED: "info",
  APPROVED: "success",
  // invoices
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  // clients
  LEAD: "info",
  INACTIVE: "neutral",
  // tickets / maintenance
  OPEN: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  SCHEDULED: "info",
  // priority
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const LABELS: Record<string, string> = { SUBMITTED: "Awaiting review", TODO: "To do" };

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"} dot className={className}>
      {LABELS[status] ?? humanize(status)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={TONES[priority] ?? "neutral"}>{humanize(priority)}</Badge>;
}
