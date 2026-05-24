import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FreightX | Logistics & Trade Finance Orchestrator",
  description: "B2B Trade Finance, Invoice Factoring, Demurrage Protection, and IoT Cold Chain escrow payments powered by USDC on Arc Testnet.",
  keywords: ["FreightX", "USDC", "Arc Network", "trade finance", "escrow", "logistics", "stablecoin", "supply chain"],
  openGraph: {
    title: "FreightX — Logistics & Trade Finance Orchestrator",
    description: "Multi-currency stablecoin escrow, invoice factoring, pre-shipment financing, and IoT compliance on Arc Network.",
    type: "website",
    siteName: "FreightX",
  },
  twitter: {
    card: "summary_large_image",
    title: "FreightX — Logistics & Trade Finance on Arc",
    description: "Multi-currency stablecoin escrow with IoT compliance, built on Circle's Arc Network.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
