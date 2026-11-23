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
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(37,99,235,0.28),0 3px 10px rgba(15,23,42,0.35);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([lat, lng], { icon: pin })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:system-ui,sans-serif;font-size:12px;">
          <strong>${collegeName.replace(/</g, "&lt;")}</strong><br/>
          <span style="color:#475569;">DTE ${collegeCode} • ${city}</span>
        </div>`
      );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, collegeName, city, collegeCode]);

  return (
    <div
      ref={ref}
      className="w-full h-[250px] rounded-2xl overflow-hidden border border-slate-200/90 z-0"
      aria-label={`Campus map for ${collegeName}`}
    />
  );
}
