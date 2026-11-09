"use client";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { archiveProjectAction } from "@/server/actions/projects";
import { ProjectForm } from "./project-form";

type FormProps = Parameters<typeof ProjectForm>[0];

export function ProjectHeaderActions({ project, clients, staff, archived }: { project: NonNullable<FormProps["project"]>; clients: FormProps["clients"]; staff: FormProps["staff"]; archived: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {archived ? (
        <ConfirmButton
          variant="secondary"
          tone="primary"
          action={() => archiveProjectAction({ id: project.id, archived: false })}
          title="Restore project?"
          description="The project becomes active again for the team and the client."
          confirmLabel="Restore"
          success="Project restored."
        >
          Restore
        </ConfirmButton>
      ) : (
        <ConfirmButton
          variant="secondary"
          action={() => archiveProjectAction({ id: project.id, archived: true })}
          title="Archive project?"
          description="Archived projects are hidden from the team and the client portal. Nothing is deleted, and you can restore it later."
          confirmLabel="Archive project"
          success="Project archived."
          redirectTo="/app/projects"
        >
          Archive
        </ConfirmButton>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">
            <Pencil /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent title="Edit project" size="lg">
          <ProjectForm project={project} clients={clients} staff={staff} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
