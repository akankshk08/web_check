"use client";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES, validateFileMeta } from "@/lib/files";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { completeUploadAction, requestUploadAction } from "@/server/actions/files";

/**
 * Upload flow: 1) server checks permissions and file rules and returns a one-time signed
 * upload token, 2) the browser uploads straight to the private bucket, 3) the server verifies
 * the stored object and publishes the file. Nothing is shown as uploaded until step 3 succeeds.
 */
export function FileUploader({
  projectId,
  taskId,
  milestoneId,
  canShare,
  deliverable = false,
  label = "Upload file",
  bucket,
}: {
  projectId: string;
  taskId?: string;
  milestoneId?: string;
  canShare: boolean;
  deliverable?: boolean;
  label?: string;
  bucket: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(deliverable);

  const upload = async (file: File) => {
    const problem = validateFileMeta(file.name, file.type, file.size);
    if (problem) return void toast.error(problem);
    setBusy(true);
    try {
      const req = await requestUploadAction({
        projectId,
        taskId: taskId ?? "",
        milestoneId: milestoneId ?? "",
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        shareWithClient: canShare && (share || deliverable),
        isDeliverable: canShare && deliverable,
      });
      if (!req.ok) return void toast.error(req.error);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(req.data.path, req.data.token, file, { contentType: file.type });
      if (error) return void toast.error("Upload failed. Please try again.");
      const done = await completeUploadAction({ attachmentId: req.data.attachmentId });
      if (!done.ok) return void toast.error(done.error);
      toast.success(`${file.name} uploaded.`);
      router.refresh();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={input} type="file" className="sr-only" accept={ACCEPT_ATTRIBUTE} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label={label} />
      <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
        <Upload /> {label}
      </Button>
      {canShare && !deliverable && (
        <label className="flex items-center gap-2 text-[13px] text-muted">
          <Checkbox checked={share} onChange={(e) => setShare(e.target.checked)} /> Share with client
        </label>
      )}
      <span className="text-xs text-muted">Max {MAX_FILE_BYTES / 1024 / 1024} MB · PDF, images, Office, ZIP, CSV, MP4</span>
    </div>
  );
}
