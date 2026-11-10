"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Card className="p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-8 last:mb-0" />
        ))}
      </Card>
    </div>
  );
}

export function ErrorState({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h1 className="text-base font-semibold">Something went wrong</h1>
      <p className="mt-1 text-[13px] text-muted">We couldn’t load this page. Please try again.{digest ? ` (ref ${digest})` : ""}</p>
      <Button className="mt-5" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </Card>
  );
}
