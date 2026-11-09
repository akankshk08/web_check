import { LocalTime } from "@/components/shared/local-time";
import { CheckCircle2, MessageSquare, RotateCcw, Send } from "lucide-react";

const ICON = { SUBMITTED: Send, APPROVED: CheckCircle2, CHANGES_REQUESTED: RotateCcw, FEEDBACK: MessageSquare } as const;
const LABEL = { SUBMITTED: "Submitted for review", APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested", FEEDBACK: "Feedback" } as const;
const TONE = { SUBMITTED: "text-info", APPROVED: "text-success", CHANGES_REQUESTED: "text-[#a86f0c]", FEEDBACK: "text-muted" } as const;

export function MilestoneHistory({
  history,
}: {
  history: { id: string; action: keyof typeof ICON; comment: string | null; createdAt: Date; actorName: string | null }[];
}) {
  if (history.length === 0) return null;
  return (
    <ol className="flex flex-col gap-3 border-l border-border pl-4">
      {history.map((h) => {
        const Icon = ICON[h.action];
        return (
          <li key={h.id} className="relative">
            <Icon className={`absolute top-0.5 -left-[25px] size-4 bg-surface ${TONE[h.action]}`} aria-hidden />
            <p className="text-[13px]">
              <span className="font-medium">{LABEL[h.action]}</span>
              <span className="text-muted">
                {" "}
                · {h.actorName ?? "Former member"} · <LocalTime value={h.createdAt} />
              </span>
            </p>
            {h.comment && <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-muted">“{h.comment}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
