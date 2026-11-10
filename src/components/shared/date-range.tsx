"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DateRangeFilter({ from, to, presets }: { from: string; to: string; presets: { label: string; from: string; to: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const go = (a: string, b: string) => router.push(`${pathname}?from=${a}&to=${b}`);
  return (
    <div className="flex flex-wrap items-end gap-2">
      {presets.map((p) => (
        <Button key={p.label} size="sm" variant={p.from === from && p.to === to ? "primary" : "secondary"} onClick={() => go(p.from, p.to)}>
          {p.label}
        </Button>
      ))}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (f && t && f <= t) go(f, t);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <Input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="h-8 w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          To
          <Input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="h-8 w-36" />
        </label>
        <Button size="sm" variant="secondary" type="submit">
          Apply
        </Button>
      </form>
    </div>
  );
}
