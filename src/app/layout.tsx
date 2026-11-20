import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { PROJECT_NAME } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: `${PROJECT_NAME}: promises that keep themselves`,
  description: "Put money on your own goal. Your friends are the witnesses. If you walk away, you lose it.",
};

export const viewport: Viewport = {
  themeColor: "#B9A4FF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
