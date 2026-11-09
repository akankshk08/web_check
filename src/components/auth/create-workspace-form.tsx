"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { errorOf, Field, fieldProps } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspaceSchema } from "@/lib/validations/auth";
import { createWorkspaceAction } from "@/server/actions/auth";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof createWorkspaceSchema>>({ resolver: zodResolver(createWorkspaceSchema), defaultValues: { agencyName: "" } });
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await createWorkspaceAction(v);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Workspace created.");
        router.replace(res.data.redirectTo);
        router.refresh();
      })}
    >
      <Field label="Agency name" htmlFor="agencyName" error={errorOf(form, "agencyName")}>
        <Input autoFocus autoComplete="organization" {...fieldProps(form, "agencyName")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Create workspace
      </Button>
    </form>
  );
}
