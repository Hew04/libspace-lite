import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { themeInitScript } from "@/components/ThemeSwitcher";
import "./globals.css";

// Serif headings + clean sans UI, in the spirit of claude.ai.
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LibSpace Lite", template: "%s · LibSpace Lite" },
  description: "Check library room availability and book a room at UTeM in under two minutes.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff1f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1e2e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
