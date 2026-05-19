import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Intervals Coach",
  description: "AI endurance coaching on top of Intervals.icu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <nav className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
              <span className="font-bold text-slate-900">Intervals Coach</span>
              <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/coach" className="text-sm text-slate-600 hover:text-slate-900">
                AI Coach
              </Link>
              <Link href="/plan" className="text-sm text-slate-600 hover:text-slate-900">
                Plan
              </Link>
            </div>
          </nav>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
