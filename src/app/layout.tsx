import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AgencyOS — One workspace. Every project. Every client.", template: "%s · AgencyOS" },
  description: "AgencyOS is the operating system for digital agencies: projects, tasks, client approvals, files, invoices and website maintenance in one workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: { title: "AgencyOS", description: "One workspace. Every project. Every client.", type: "website", siteName: "AgencyOS" },
  twitter: { card: "summary_large_image", title: "AgencyOS", description: "One workspace. Every project. Every client." },
};

export const viewport: Viewport = { themeColor: "#151923" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        {/* Cookieless page-view analytics (active when deployed on Vercel). */}
        <Analytics />
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: "text-sm" }} />
      </body>
    </html>
  );
}
