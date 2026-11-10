import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#151923" />
      <path d="M9 22 15.2 9.5a1 1 0 0 1 1.8 0L23 22" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="19" r="2.2" fill="#536DFE" />
    </svg>
  );
}

export function Logo({ href = "/", inverted = false }: { href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", inverted ? "text-white" : "text-foreground")}>
      <LogoMark className={inverted ? "[&_rect]:fill-[#2a3142]" : undefined} />
      <span className="text-[15px]">AgencyOS</span>
    </Link>
  );
}
