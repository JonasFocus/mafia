import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://mafia-ashy-beta.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Mafia - party game",
  description:
    "A party game of bluffing and deduction. One of you is faking it - blend in, or expose the impostor.",
  applicationName: "Mafia",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Mafia" },
  openGraph: {
    title: "Mafia - party game",
    description: "A party game of bluffing and deduction. One of you is faking it.",
    type: "website",
    siteName: "Mafia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mafia - party game",
    description: "A party game of bluffing and deduction. One of you is faking it.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070506",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
