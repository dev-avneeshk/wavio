import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: site.pageTitle,
  description: site.description,
  // iPhones can't hide Safari's bars for a web page; opened from the home screen, it's full screen.
  appleWebApp: { capable: true, title: site.brand, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#dde8ee",
  // Phones held sideways: draw under the notch; the controls keep clear of it (safe-area insets).
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  );
}
