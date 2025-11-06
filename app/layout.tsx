import type React from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SolanaProvider } from "@/components/solana-provider";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Post402",
  description: "Create and share premium content with paywall support",
  icons: {
    icon: "/favicon.webp",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-mono antialiased">
        <SolanaProvider>
          <Suspense fallback={null}>{children}</Suspense>
          <Analytics />
        </SolanaProvider>
      </body>
    </html>
  );
}
