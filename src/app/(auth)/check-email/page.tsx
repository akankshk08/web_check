import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthCard title="Check your email" description="We’ve sent you a confirmation link. Open it to activate your account, then sign in.">
      <div className="flex items-center gap-3 rounded-md bg-primary-soft p-4 text-[13px] text-primary">
        <MailCheck className="size-5 shrink-0" aria-hidden />
        Didn’t get it? Check your spam folder first.
      </div>
      <div className="mt-5">
        <ResendConfirmationForm />
      </div>
      <Link href="/login" className="mt-5 inline-block text-[13px] font-medium text-primary hover:underline">
        Go to sign in
      </Link>
    </AuthCard>
  );
}
