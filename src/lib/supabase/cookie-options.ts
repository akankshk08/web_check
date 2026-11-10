/** Session cookies: not readable by page JavaScript, HTTPS-only in production, sent on same-site navigations. */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
