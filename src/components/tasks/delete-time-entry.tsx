"use client";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { deleteTimeEntryAction } from "@/server/actions/tasks";

export function DeleteTimeEntryButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      size="icon-sm"
      variant="ghost"
      aria-label="Delete time entry"
      action={() => deleteTimeEntryAction({ id })}
      title="Delete time entry?"
      description="This entry will be removed from your timesheet and reports."
      confirmLabel="Delete"
      success="Entry deleted."
    >
      <Trash2 />
    </ConfirmButton>
  );
}
