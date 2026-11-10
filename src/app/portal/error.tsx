"use client";
import { ErrorState } from "@/components/shared/states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} digest={error.digest} />;
}
