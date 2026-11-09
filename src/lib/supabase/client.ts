"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client (public anon key only). Used for direct-to-storage signed uploads. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
