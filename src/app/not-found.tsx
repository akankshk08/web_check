import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Logo />
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-[13px] text-muted">The page you’re looking for doesn’t exist, or you don’t have access to it.</p>
      <Button asChild variant="secondary">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
