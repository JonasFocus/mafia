import type { Metadata, Viewport } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mafia — party game",
  description:
    "A party game of bluffing and deduction. One of you is faking it — blend in, or expose the impostor.",
  applicationName: "Mafia",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Mafia" },
  openGraph: {
    title: "Mafia — party game",
    description: "A party game of bluffing and deduction. One of you is faking it.",
    type: "website",
    siteName: "Mafia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mafia — party game",
    description: "A party game of bluffing and deduction. One of you is faking it.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0912",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
