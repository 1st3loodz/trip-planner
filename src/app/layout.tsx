import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { TripProvider } from "@/contexts/TripContext";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

import ClientAuthGuard from "@/components/ClientAuthGuard";

export const viewport: Viewport = {
  themeColor: "#f5efe6",
};

export const metadata: Metadata = {
  title: "Nomadic Journey — Cozy Adventure Journal",
  description:
    "Plan your group adventures. Build day-by-day itineraries and split expenses fairly with Nomadic Journey.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nomadic",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart2P.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ClientAuthGuard>
            <CurrencyProvider>
              <TripProvider>
                {children}
              </TripProvider>
            </CurrencyProvider>
          </ClientAuthGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
