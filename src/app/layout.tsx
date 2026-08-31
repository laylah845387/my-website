import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import Navbar from "@/components/Navbar";
import ToastContainer from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CapeVerse — Earn Rewards",
  description:
    "Complete tasks to earn points and redeem them for exclusive digital rewards on CapeVerse.",
  keywords: ["capeverse", "rewards", "offerwall", "points", "digital cosmetics"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable}`}>
      <body className="min-h-screen bg-bg text-text-primary font-body antialiased">
        <AppProvider>
          <Navbar />
          <main>{children}</main>
          <ToastContainer />
        </AppProvider>
      </body>
    </html>
  );
}
