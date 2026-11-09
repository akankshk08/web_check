import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-[13px] font-medium text-muted transition-colors hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4 pb-3 md:hidden" aria-label="Main mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[13px] font-medium whitespace-nowrap text-muted">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <Logo />
            <p className="mt-2 text-[13px] text-muted">One workspace. Every project. Every client.</p>
          </div>
          <nav className="flex flex-wrap gap-5 text-[13px] text-muted" aria-label="Footer">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-foreground">
                {n.label}
              </Link>
            ))}
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">© {new Date().getFullYear()} AgencyOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
