import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { ModelChip } from "@/components/model-chip";

export const metadata: Metadata = { title: "HireWise", description: "AI-assisted recruitment workflow" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Sidebar />
          <main className="ml-64 min-h-screen p-8 pb-20">{children}</main>
          <ModelChip />
        </Providers>
      </body>
    </html>
  );
}
