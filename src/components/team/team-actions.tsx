"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, MoreHorizontal, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { errorOf, Field, fieldProps, useAction, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Input, Select } from "@/components/ui/input";
import { inviteMemberSchema } from "@/lib/validations/entities";
import { changeRoleAction, financeAccessAction, inviteMemberAction, removeMemberAction } from "@/server/actions/team";

export function InviteMemberDialog({ canInviteAdmins }: { canInviteAdmins: boolean }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const form = useForm<z.infer<typeof inviteMemberSchema>>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: "", role: "EMPLOYEE" } });
  const onSubmit = useActionSubmit(form, inviteMemberAction, {
    success: "Invitation sent.",
    onSuccess: (d) => {
      setLink(d.url);
      form.reset({ email: "", role: "EMPLOYEE" });
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setLink(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent title="Invite a team member" description="They’ll get an email with a link that works once and expires in 7 days.">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email" error={errorOf(form, "email")} required>
            <Input type="email" {...fieldProps(form, "email")} />
          </Field>
          <Field label="Role" htmlFor="role" error={errorOf(form, "role")}>
            <Select {...fieldProps(form, "role")}>
              <option value="EMPLOYEE">Employee — works on assigned projects</option>
              {canInviteAdmins && <option value="ADMIN">Admin — manages clients, projects and team</option>}
            </Select>
          </Field>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Send invitation
          </Button>
        </form>
        {link && (
          <div className="mt-4 rounded-md bg-subtle p-3 text-xs">
            <p className="mb-1 text-muted">Invitation link (also sent by email if email is configured):</p>
            <div className="flex items-center gap-2">
              <span className="truncate">{link}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Link copied.");
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MemberMenu({
  member,
  isOwner,
  isSelf,
}: {
  member: { memberId: string; fullName: string; role: string; canManageFinances: boolean };
  isOwner: boolean;
  isSelf: boolean;
}) {
  const { pending, run } = useAction();
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (member.role === "OWNER" || isSelf) return null;
  const canRemove = isOwner || member.role === "EMPLOYEE";
  if (!isOwner && !canRemove) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1.5 text-muted hover:bg-subtle" aria-label={`Actions for ${member.fullName}`}>
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {isOwner && member.role === "EMPLOYEE" && (
            <DropdownMenuItem onSelect={() => run(() => changeRoleAction({ memberId: member.memberId, role: "ADMIN" }), { success: "Promoted to admin." })}>
              Make admin
            </DropdownMenuItem>
          )}
          {isOwner && member.role === "ADMIN" && (
            <>
              <DropdownMenuItem onSelect={() => run(() => changeRoleAction({ memberId: member.memberId, role: "EMPLOYEE" }), { success: "Changed to employee." })}>
                Change to employee
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(() => financeAccessAction({ memberId: member.memberId, canManageFinances: !member.canManageFinances }), {
                    success: member.canManageFinances ? "Finance access removed." : "Finance access granted.",
                  })
                }
              >
                {member.canManageFinances ? "Remove finance access" : "Grant finance access"}
              </DropdownMenuItem>
            </>
          )}
          {canRemove && (
            <DropdownMenuItem destructive onSelect={() => setConfirmRemove(true)}>
              Remove from workspace
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent
          title={`Remove ${member.fullName}?`}
          description="They lose access immediately. Their open tasks become unassigned and they’re removed from projects. Their past work and comments are kept."
          confirmLabel="Remove member"
          pending={pending}
          onConfirm={async (e) => {
            e.preventDefault();
            if (await run(() => removeMemberAction({ memberId: member.memberId }), { success: "Member removed." })) setConfirmRemove(false);
          }}
        />
      </AlertDialog>
    </>
  );
}
