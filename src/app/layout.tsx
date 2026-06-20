import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Nomadic Journey — Cozy Adventure Journal",
  description:
    "Plan your group adventures. Build day-by-day itineraries and split expenses fairly with Nomadic Journey.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌍</text></svg>",
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
