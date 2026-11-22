import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CAP Compass — MHT-CET Admission Predictor by Arsh Shaikh",
    short_name: "CAP Compass",
    description:
      "Maharashtra MHT-CET Engineering College Predictor, Smart CAP Option Form Builder, What-If Score Simulator & Document Checklist. Built by Arsh Shaikh.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0B1120",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
