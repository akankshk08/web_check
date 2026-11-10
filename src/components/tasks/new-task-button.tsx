"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm, type TaskFormOptions } from "./task-form";

export function NewTaskButton({ projectId, options }: { projectId: string; options: TaskFormOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New task
        </Button>
      </DialogTrigger>
      <DialogContent title="New task" size="lg">
        <TaskForm projectId={projectId} options={options} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
