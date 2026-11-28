import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import NavigationShell from "@/components/NavigationShell";
import ToastProvider from "@/components/ui/ToastProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172554",
};

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
  title: "CAP Compass | MHT-CET Engineering Admission Intelligence Platform",
  description:
    "Explore 400 Maharashtra engineering colleges, analyze category-wise rank & percentile cutoffs across 2023–2026 CAP Rounds 1–4, and build your optimal DTE preference list. Designed & developed by Arsh Shaikh.",
  authors: [{ name: "Arsh Shaikh" }],
  creator: "Arsh Shaikh",
  publisher: "Arsh Shaikh",
  applicationName: "CAP Compass",
  icons: {
    icon: [
      { url: "/brand/logo-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/brand/app-icon-192.png", sizes: "192x192" }],
  },
  keywords: [
    "MHT-CET college predictor",
    "CAP cutoff",
    "Maharashtra engineering admission",
    "option form",
    "CAP Compass",
    "Arsh Shaikh",
  ],
  openGraph: {
    title: "CAP Compass — MHT-CET Admission Intelligence Platform",
    description:
      "Category-wise rank & percentile predictions, Smart Option Form, Betterment Radar, Interactive Map & What-If simulator.",
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
        className={`${plusJakarta.className} bg-[#F8FAFC] text-[#1E293B] min-h-screen antialiased selection:bg-[#4F46E5]/15 selection:text-[#172554]`}
      >
        <NavigationShell>{children}</NavigationShell>
        <ToastProvider />
      </body>
    </html>
  );
}
