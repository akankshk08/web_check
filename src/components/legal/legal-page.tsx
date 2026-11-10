import type * as React from "react";
import { LEGAL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-muted">Effective {LEGAL.effectiveDate}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-foreground [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:text-muted [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted">
        {children}
      </div>
    </article>
  );
}
