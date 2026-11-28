"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  collegeName: string;
  city: string;
  collegeCode: string;
}

export default function CollegeMiniMap({
  lat,
  lng,
  collegeName,
  city,
  collegeCode,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(ref.current, {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const pin = L.divIcon({
      className: "cap-mini-pin",
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#4F46E5;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(79,70,229,0.25),0 3px 10px rgba(23,37,84,0.35);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    // Construct popup using safe DOM nodes (textContent) — prevents DOM XSS
    const popupEl = document.createElement("div");
    popupEl.style.fontFamily = "system-ui, sans-serif";
    popupEl.style.fontSize = "12px";

    const nameStrong = document.createElement("strong");
    nameStrong.textContent = collegeName || "";
    popupEl.appendChild(nameStrong);
    popupEl.appendChild(document.createElement("br"));

    const metaSpan = document.createElement("span");
    metaSpan.style.color = "#475569";
    metaSpan.textContent = `DTE ${collegeCode} • ${city}`;
    popupEl.appendChild(metaSpan);

    L.marker([lat, lng], { icon: pin }).addTo(map).bindPopup(popupEl);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, collegeName, city, collegeCode]);

  return (
    <div
      ref={ref}
      className="w-full h-[250px] rounded-2xl overflow-hidden border border-[#E2E8F0] z-0"
      aria-label={`Campus map for ${collegeName}`}
    />
  );
}
