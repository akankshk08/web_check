"use client";
import Link from "next/link";

/** Last-resort error page if the root layout itself fails. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#172033", display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#697386", fontSize: 14 }}>
            Please try again. If it keeps happening, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #e7eaf0", background: "white", cursor: "pointer" }}>
              Try again
            </button>
            <Link href="/" style={{ padding: "8px 16px", borderRadius: 6, background: "#536DFE", color: "white", textDecoration: "none" }}>
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
