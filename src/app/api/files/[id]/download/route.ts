import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { requireAuth } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { routeError } from "@/server/route";
import { getDownloadUrl } from "@/server/services/files";
import { supabaseStorage } from "@/server/storage";

/** Checks access, then redirects to a 60-second signed URL for the private object. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new NotFoundError("File not found.");
    const ctx = await requireAuth();
    const url = await getDownloadUrl(getDb(), supabaseStorage(), ctx, id);
    const res = NextResponse.redirect(url, { status: 302 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    return routeError(err);
  }
}
