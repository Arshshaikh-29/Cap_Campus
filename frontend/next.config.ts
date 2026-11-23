import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:8000";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isProd
        ? "script-src 'self' 'unsafe-inline' https://accounts.google.com https://checkout.razorpay.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "frame-src 'self' https://accounts.google.com https://api.razorpay.com https://checkout.razorpay.com",
      `connect-src 'self' https://cap-campus.onrender.com https://accounts.google.com https://oauth2.googleapis.com https://api.razorpay.com https://lumberjack.razorpay.com ${apiOrigin}${
        isProd
          ? ""
          : " http://localhost:8000 http://127.0.0.1:8000 ws://localhost:3000 ws://127.0.0.1:3000"
      }`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
