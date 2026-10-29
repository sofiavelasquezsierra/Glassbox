import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { themeScript } from "@/components/site/ThemeToggle";
import { PlusGrid } from "@/components/site/PlusGrid";
import { TopNav } from "@/components/site/TopNav";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  openGraph: { type: "website", siteName: "Glassbox", title: "Glassbox: an AI analytics agent that shows its work" },
  twitter: { card: "summary_large_image" },
  title: { default: "Glassbox: an AI analytics agent that shows its work", template: "%s · Glassbox" },
  description:
    "A design-engineering demo: an AI agent answers business questions over a Supabase database, states its assumptions, has a second agent review its SQL, and makes every number traceable.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="relative isolate">
        <PlusGrid />
        <TopNav />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
