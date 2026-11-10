"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { changeRequestSchema, milestoneDecisionSchema } from "@/lib/validations/entities";
import { approveMilestoneAction, milestoneFeedbackAction, requestChangesAction } from "@/server/actions/milestones";

function DecisionDialog({
  milestoneId,
  kind,
}: {
  milestoneId: string;
  kind: "approve" | "changes" | "feedback";
}) {
  const [open, setOpen] = useState(false);
  const schema = kind === "approve" ? milestoneDecisionSchema : changeRequestSchema;
  const form = useForm<z.infer<typeof milestoneDecisionSchema>>({ resolver: zodResolver(schema), defaultValues: { milestoneId, comment: "" } });
  const action = kind === "approve" ? approveMilestoneAction : kind === "changes" ? requestChangesAction : milestoneFeedbackAction;
  const copy = {
    approve: { title: "Approve milestone", description: "Confirm that this milestone is complete and meets your expectations.", button: "Approve", success: "Milestone approved. Thank you!", label: "Comment (optional)" },
    changes: { title: "Request changes", description: "Tell the team what needs to change. They’ll be notified straight away.", button: "Request changes", success: "Change request sent.", label: "What needs to change?" },
    feedback: { title: "Leave feedback", description: "Share thoughts without approving or requesting changes.", button: "Send feedback", success: "Feedback sent.", label: "Your feedback" },
  }[kind];
  const onSubmit = useActionSubmit(form, action, { success: copy.success, onSuccess: () => setOpen(false) });
  const Icon = kind === "approve" ? CheckCircle2 : kind === "changes" ? RotateCcw : MessageSquare;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={kind === "approve" ? "primary" : "secondary"}>
          <Icon /> {copy.button}
        </Button>
      </DialogTrigger>
      <DialogContent title={copy.title} description={copy.description}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label={copy.label} htmlFor="comment" error={errorOf(form, "comment")} required={kind !== "approve"}>
            <Textarea rows={4} {...fieldProps(form, "comment")} />
          </Field>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            {copy.button}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewActions({ milestoneId, canDecide }: { milestoneId: string; canDecide: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide && <DecisionDialog milestoneId={milestoneId} kind="approve" />}
      {canDecide && <DecisionDialog milestoneId={milestoneId} kind="changes" />}
      <DecisionDialog milestoneId={milestoneId} kind="feedback" />
    </div>
  );
}
