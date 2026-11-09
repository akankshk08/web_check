import { FileList } from "@/components/files/file-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireClientPage } from "@/server/auth/session";
import { orNotFound } from "@/server/page";
import { listProjectFiles } from "@/server/services/files";

export default async function PortalDeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const files = await orNotFound(listProjectFiles(getDb(), ctx, id, { deliverablesOnly: true }));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Deliverables</CardTitle>
          <p className="mt-0.5 text-[13px] text-muted">Work your agency has delivered for review. Approve it from the Milestones tab.</p>
        </div>
      </CardHeader>
      <CardContent>
        <FileList files={files} showVisibility={false} empty="No deliverables have been shared yet." />
      </CardContent>
    </Card>
  );
}
