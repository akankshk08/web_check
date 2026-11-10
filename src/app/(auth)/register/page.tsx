import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create your workspace" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your agency workspace"
      description="You’ll be the owner. Invite your team and clients afterwards."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
      <p className="mt-4 text-center text-xs text-muted">
        By creating a workspace you agree to our{" "}
        <Link href="/terms" className="text-primary hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthCard>
  );
}
