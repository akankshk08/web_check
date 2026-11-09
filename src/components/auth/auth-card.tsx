import type * as React from "react";
import { Card } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <Card className="p-6 sm:p-7">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </Card>
      {footer && <div className="mt-5 text-center text-[13px] text-muted">{footer}</div>}
    </>
  );
}
