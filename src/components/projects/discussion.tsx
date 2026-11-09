"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { projectCommentSchema } from "@/lib/validations/entities";
import { addProjectCommentAction } from "@/server/actions/projects";

type Comment = { id: string; body: string; visibility: "INTERNAL" | "CLIENT"; createdAt: Date; authorName: string | null };

export function Discussion({ projectId, comments, isClient }: { projectId: string; comments: Comment[]; isClient: boolean }) {
  const form = useForm<z.infer<typeof projectCommentSchema>>({
    resolver: zodResolver(projectCommentSchema),
    defaultValues: { projectId, body: "", visibility: isClient ? "CLIENT" : "INTERNAL" },
  });
  const onSubmit = useActionSubmit(form, addProjectCommentAction, { onSuccess: () => form.reset({ projectId, body: "", visibility: form.getValues("visibility") }) });

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-[13px] text-muted">No messages yet. Start the conversation.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName ?? "Former member"} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium">{c.authorName ?? "Former member"}</span>
                  <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                  {!isClient && c.visibility === "INTERNAL" && (
                    <span className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 text-[11px] text-[#8a5a08]">
                      <Lock className="size-3" aria-hidden /> Internal
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 border-t border-border pt-4">
        <label htmlFor="body" className="sr-only">
          Message
        </label>
        <Textarea rows={3} placeholder={isClient ? "Write a message to the team…" : "Write a message…"} {...fieldProps(form, "body")} />
        {errorOf(form, "body") && <p className="text-xs text-danger">{errorOf(form, "body")}</p>}
        <div className="flex items-center justify-end gap-2">
          {!isClient && (
            <Select className="w-auto" aria-label="Visibility" {...form.register("visibility")}>
              <option value="INTERNAL">Internal (team only)</option>
              <option value="CLIENT">Shared with client</option>
            </Select>
          )}
          <Button type="submit" size="sm" loading={form.formState.isSubmitting}>
            Post
          </Button>
        </div>
      </form>
    </div>
  );
}
