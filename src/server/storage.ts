import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";

/** Storage operations used by the file service. Swappable in tests. */
export interface StorageAdapter {
  createSignedUploadUrl(path: string): Promise<{ token: string; path: string }>;
  createSignedDownloadUrl(path: string, expiresInSeconds: number, downloadName: string): Promise<string>;
  objectSize(path: string): Promise<number | null>;
  remove(paths: string[]): Promise<void>;
}

/** Supabase Storage (private bucket) using the server-only service role key. */
export function supabaseStorage(): StorageAdapter {
  const bucket = serverEnv().SUPABASE_STORAGE_BUCKET;
  const client = () => createSupabaseAdminClient().storage.from(bucket);
  return {
    async createSignedUploadUrl(path) {
      const { data, error } = await client().createSignedUploadUrl(path);
      if (error || !data) throw new Error(`Storage upload URL failed: ${error?.message}`);
      return { token: data.token, path: data.path };
    },
    async createSignedDownloadUrl(path, expiresInSeconds, downloadName) {
      const { data, error } = await client().createSignedUrl(path, expiresInSeconds, { download: downloadName });
      if (error || !data) throw new Error(`Storage signed URL failed: ${error?.message}`);
      return data.signedUrl;
    },
    async objectSize(path) {
      const { data, error } = await client().info(path);
      if (error || !data) return null;
      return typeof data.size === "number" ? data.size : null;
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await client().remove(paths);
      if (error) console.error("[storage] remove failed:", error.message);
    },
  };
}
