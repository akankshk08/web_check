import { FileList } from "@/components/files/file-list";
import { FileUploader } from "@/components/files/file-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { serverEnv } from "@/lib/server-env";
import { isManager } from "@/server/auth/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listProjectFiles } from "@/server/services/files";

export default async function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const files = await orNotFound(listProjectFiles(getDb(), ctx, id));
  const manager = isManager(ctx);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Project files</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted">Files are stored privately. Downloads use links that expire after 60 seconds.</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FileUploader projectId={id} canShare={manager} bucket={serverEnv().SUPABASE_STORAGE_BUCKET} />
        <FileList files={files.map((f) => ({ ...f, canDelete: manager || f.uploadedById === ctx.userId }))} empty="No files uploaded yet." />
      </CardContent>
    </Card>
  );
}
