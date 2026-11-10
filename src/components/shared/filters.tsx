"use client";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input, Select } from "@/components/ui/input";
import { cn, humanize } from "@/lib/utils";

/** Search box + select filters that keep their state in the URL (shareable, server-rendered results). */
export function FilterBar({
  searchPlaceholder = "Search…",
  filters = [],
  className,
}: {
  searchPlaceholder?: string | null;
  filters?: { name: string; label: string; options: (string | { value: string; label: string })[] }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  const update = (key: string, value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => update("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)} aria-busy={pending}>
      {searchPlaceholder !== null && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-9" aria-label="Search" maxLength={100} />
        </div>
      )}
      {filters.map((f) => (
        <Select
          key={f.name}
          aria-label={f.label}
          className="sm:w-44"
          value={params.get(f.name) ?? ""}
          onChange={(e) => update(f.name, e.target.value)}
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: humanize(o) } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </Select>
      ))}
    </div>
  );
}
