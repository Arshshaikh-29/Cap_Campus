import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAP Compass — Enterprise MHT-CET Admission Intelligence Platform",
    short_name: "CAP Compass",
    description:
      "Explore 400 Maharashtra engineering colleges, analyze 2023–2026 CAP Rounds 1–4 cutoffs, and build scientifically ordered DTE Option Forms.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#172554",
    icons: [
      {
        src: "/brand/logo-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/brand/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
