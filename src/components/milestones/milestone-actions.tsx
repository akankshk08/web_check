"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { errorOf, Field, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { MilestoneStatus } from "@/db/schema/enums";
import { milestoneDecisionSchema, milestoneSchema, updateMilestoneSchema } from "@/lib/validations/entities";
import { createMilestoneAction, deleteMilestoneAction, submitMilestoneAction, updateMilestoneAction } from "@/server/actions/milestones";

export function NewMilestoneButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof milestoneSchema>>({ resolver: zodResolver(milestoneSchema), defaultValues: { projectId, title: "", description: "", dueDate: "" } });
  const onSubmit = useActionSubmit(form, createMilestoneAction, {
    success: "Milestone added.",
    onSuccess: () => {
      setOpen(false);
      form.reset();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New milestone
        </Button>
      </DialogTrigger>
      <DialogContent title="New milestone" description="Milestones are visible to the client in their portal.">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Title" htmlFor="title" error={errorOf(form, "title")} required>
            <Input {...fieldProps(form, "title")} placeholder="e.g. UI/UX Design" />
          </Field>
          <Field label="Description" htmlFor="description" error={errorOf(form, "description")}>
            <Textarea rows={3} {...fieldProps(form, "description")} />
          </Field>
          <Field label="Due date" htmlFor="dueDate" error={errorOf(form, "dueDate")}>
            <Input type="date" {...fieldProps(form, "dueDate")} />
          </Field>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Add milestone
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMilestoneButton({ milestone }: { milestone: { id: string; title: string; description: string | null; dueDate: string | null; status: MilestoneStatus } }) {
  const [open, setOpen] = useState(false);
  const editableStatus = milestone.status === "NOT_STARTED" || milestone.status === "IN_PROGRESS";
  const form = useForm<z.infer<typeof updateMilestoneSchema>>({
    resolver: zodResolver(updateMilestoneSchema),
    defaultValues: {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description ?? "",
      dueDate: milestone.dueDate ?? "",
      status: editableStatus ? (milestone.status as "NOT_STARTED" | "IN_PROGRESS") : "IN_PROGRESS",
    },
  });
  const onSubmit = useActionSubmit(form, updateMilestoneAction, { success: "Milestone updated.", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Edit ${milestone.title}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit milestone">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Title" htmlFor="title" error={errorOf(form, "title")} required>
            <Input {...fieldProps(form, "title")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errorOf(form, "description")}>
            <Textarea rows={3} {...fieldProps(form, "description")} />
          </Field>
          <Field label="Due date" htmlFor="dueDate" error={errorOf(form, "dueDate")}>
            <Input type="date" {...fieldProps(form, "dueDate")} />
          </Field>
          {editableStatus && (
            <Field label="Status" htmlFor="status" error={errorOf(form, "status")}>
              <Select {...fieldProps(form, "status")}>
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
              </Select>
            </Field>
          )}
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMilestoneButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmButton
      size="sm"
      variant="ghost"
      aria-label={`Delete ${title}`}
      action={() => deleteMilestoneAction({ id })}
      title="Delete milestone?"
      description={`“${title}” will be removed. Tasks linked to it are kept but no longer grouped under it.`}
      confirmLabel="Delete milestone"
      success="Milestone deleted."
    >
      <Trash2 />
    </ConfirmButton>
  );
}

export function SubmitForReviewButton({ milestoneId, hasClientUsers }: { milestoneId: string; hasClientUsers: boolean }) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof milestoneDecisionSchema>>({ resolver: zodResolver(milestoneDecisionSchema), defaultValues: { milestoneId, comment: "" } });
  const onSubmit = useActionSubmit(form, submitMilestoneAction, { success: "Submitted for client review.", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send /> Submit for review
        </Button>
      </DialogTrigger>
      <DialogContent title="Submit for client review" description="The client’s approvers are notified and can approve or request changes from their portal.">
        {!hasClientUsers && (
          <p className="mb-4 rounded-md bg-warning-soft p-3 text-[13px] text-[#8a5a08]">This client has no portal users yet. Invite one from the client’s page so they can review it.</p>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Note to the client (optional)" htmlFor="comment" error={errorOf(form, "comment")}>
            <Textarea rows={3} {...fieldProps(form, "comment")} />
          </Field>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Submit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

