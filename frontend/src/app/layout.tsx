import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import NavigationShell from "@/components/NavigationShell";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CAP Compass | MHT-CET Engineering Admission Predictor by Arsh Shaikh",
  description:
    "Explore 400 Maharashtra engineering colleges, analyze category-wise rank & percentile cutoffs across 2023–2026 CAP Rounds 1–4, and build your optimal preference list. Designed & developed by Arsh Shaikh.",
  authors: [{ name: "Arsh Shaikh" }],
  creator: "Arsh Shaikh",
  publisher: "Arsh Shaikh",
  applicationName: "CAP Compass",
  keywords: [
    "MHT-CET college predictor",
    "CAP cutoff",
    "Maharashtra engineering admission",
    "option form",
    "Arsh Shaikh",
  ],
  openGraph: {
    title: "CAP Compass — MHT-CET College Predictor",
    description:
      "Category-wise rank & percentile predictions, Smart Option Form and What-If simulator. Built by Arsh Shaikh.",
    siteName: "CAP Compass",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className={`${plusJakarta.className} bg-[#F8FAFC] text-foreground min-h-screen antialiased selection:bg-electric-blue/20`}
      >
        <NavigationShell>{children}</NavigationShell>
      </body>
    </html>
  );
}
