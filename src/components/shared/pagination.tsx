import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface hover:bg-subtle";
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px] text-muted">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={`${btn} opacity-40`} aria-hidden>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <span className="px-2">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={btn} aria-label="Next page">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={`${btn} opacity-40`} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
