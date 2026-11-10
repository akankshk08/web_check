import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie and returns the signed-in user id (if any). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, userId: null as string | null };

  const supabase = createServerClient(url, key, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // getUser() validates the token with Supabase Auth (never trust the cookie alone).
  const { data } = await supabase.auth.getUser();
  return { response, userId: data.user?.id ?? null };
}
