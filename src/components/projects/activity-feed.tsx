import { History } from "lucide-react";
import { EmptyState } from "@/components/shared/page";

export function ActivityFeed({ rows }: { rows: { id: string; summary: string; createdAt: Date; actorName: string | null }[] }) {
  if (rows.length === 0) return <EmptyState icon={History} title="No activity yet" />;
  return (
    <ol className="divide-y divide-border">
      {rows.map((a) => (
        <li key={a.id} className="flex items-start gap-3 px-5 py-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">{a.summary}</p>
            <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
