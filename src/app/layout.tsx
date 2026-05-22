import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://realcorp.com"),
  title: {
    default: "Realcorp",
    template: "%s · Realcorp",
  },
  description: "Multi-tenant PropTech CRM & ERP for real estate developers.",
  icons: {
    icon: [{ url: "/fav.svg", type: "image/svg+xml" }],
    apple: [{ url: "/fav.svg", type: "image/svg+xml" }],
  },
  applicationName: "Realcorp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
