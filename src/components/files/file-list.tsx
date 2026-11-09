"use client";
import { Download, FileText, Lock, Trash2, Users } from "lucide-react";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { deleteAttachmentAction } from "@/server/actions/files";

export type FileRow = {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
  visibility?: "INTERNAL" | "CLIENT";
  isDeliverable?: boolean;
  uploadedByName?: string | null;
  canDelete?: boolean;
};

export function FileList({ files, showVisibility = true, empty = "No files yet." }: { files: FileRow[]; showVisibility?: boolean; empty?: string }) {
  if (files.length === 0) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
          <FileText className="size-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{f.fileName}</p>
            <p className="text-xs text-muted">
              {formatBytes(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString()}
              {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
            </p>
          </div>
          {showVisibility && f.isDeliverable && <Badge tone="success">Deliverable</Badge>}
          {showVisibility &&
            f.visibility &&
            (f.visibility === "CLIENT" ? (
              <Badge tone="info">
                <Users className="size-3" aria-hidden /> Shared
              </Badge>
            ) : (
              <Badge>
                <Lock className="size-3" aria-hidden /> Internal
              </Badge>
            ))}
          <a href={`/api/files/${f.id}/download`} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground" aria-label={`Download ${f.fileName}`}>
            <Download className="size-4" />
          </a>
          {f.canDelete && (
            <ConfirmButton
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${f.fileName}`}
              action={() => deleteAttachmentAction({ id: f.id })}
              title="Delete file?"
              description={`${f.fileName} will be permanently removed from storage.`}
              confirmLabel="Delete file"
              success="File deleted."
            >
              <Trash2 />
            </ConfirmButton>
          )}
        </li>
      ))}
    </ul>
  );
}
