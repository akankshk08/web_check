import "server-only";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Supabase client bound to the current request's auth cookies (anon key, user session). */
export async function createSupabaseServerClient() {
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}
