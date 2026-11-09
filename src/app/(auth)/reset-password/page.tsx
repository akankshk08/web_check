import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/forms";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <AuthCard title="Link expired" description="This password reset link is no longer valid.">
        <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" description={`For ${user.email}`}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
