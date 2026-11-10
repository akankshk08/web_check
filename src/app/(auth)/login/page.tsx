import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; deleted?: string }> }) {
  const { next, error, deleted } = await searchParams;
  return (
    <AuthCard
      title="Sign in to AgencyOS"
      description="Welcome back. Use the email you registered or were invited with."
      footer={
        <>
          New to AgencyOS?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create a workspace
          </Link>
        </>
      }
    >
      {deleted === "1" && (
        <p className="mb-4 rounded-md bg-success-soft p-3 text-[13px] text-success" role="status">
          Your account has been deleted.
        </p>
      )}
      {error === "link" && (
        <p className="mb-4 rounded-md bg-warning-soft p-3 text-[13px] text-[#8a5a08]" role="alert">
          That link is invalid or has expired. Please sign in or request a new link.
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </AuthCard>
  );
}
