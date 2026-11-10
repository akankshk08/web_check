import { FileList } from "@/components/files/file-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listProjectFiles } from "@/server/services/files";

export default async function PortalFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const files = await orNotFound(listProjectFiles(getDb(), ctx, id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared files</CardTitle>
      </CardHeader>
      <CardContent>
        <FileList files={files} showVisibility={false} empty="No files have been shared with you yet." />
      </CardContent>
    </Card>
  );
}
