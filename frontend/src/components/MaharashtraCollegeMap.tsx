"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapCollegeItem {
  college_code: string;
  college_name: string;
  city: string;
  lat: number;
  lng: number;
  is_exact_campus: boolean;
  google_maps_url: string;
  branches_count: number;
  top_branch?: string | null;
  top_cutoff_percentile?: number | null;
  top_cutoff_rank?: number | null;
  top_cutoff_year?: number | null;
  is_autonomous?: boolean;
  is_minority?: boolean;
  official_website?: string | null;
  website_domain?: string | null;
  cet_portal_url?: string | null;
  nirf_median_lpa?: number | null;
  annual_fee_inr?: number | null;
  prediction_category?: string;
  chance_level?: string;
  matched_branch?: string;
  matched_percentile?: number | null;
  matched_rank?: number | null;
  margin_percentile?: number | null;
  matched_year?: number | null;
  matched_round?: number | null;
  matched_courses_count?: number;
  distance_km?: number | null;
}

export type MapTileStyle = "osm" | "esri" | "satellite";

const TILE_LAYERS: Record<
  MapTileStyle,
  { url: string; attribution: string; maxZoom: number }
> = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  esri: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, OSM",
    maxZoom: 18,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
};

interface Props {
  colleges: MapCollegeItem[];
  selectedCode: string | null;
  onSelect: (college: MapCollegeItem) => void;
  scoreMode: boolean;
  tileStyle: MapTileStyle;
  userLocation: { lat: number; lng: number } | null;
  focusTarget: { lat: number; lng: number; zoom: number; nonce: number } | null;
}

function getPinColors(c: MapCollegeItem, scoreMode: boolean, isSelected: boolean) {
  if (isSelected) {
    return { bg: "#0B1120", ring: "#2563EB", text: "#FFFFFF", size: 18 };
  }
  if (scoreMode) {
    if (c.prediction_category === "Historically Within Range") {
      return { bg: "#10B981", ring: "#FFFFFF", text: "#FFFFFF", size: 13 };
    }
    if (c.prediction_category === "Moderate") {
      return { bg: "#F59E0B", ring: "#FFFFFF", text: "#FFFFFF", size: 13 };
    }
    return { bg: "#F43F5E", ring: "#FFFFFF", text: "#FFFFFF", size: 12 };
  }
  if (c.nirf_median_lpa != null) {
    return { bg: "#2563EB", ring: "#FFFFFF", text: "#FFFFFF", size: 14 };
  }
  return { bg: "#475569", ring: "#FFFFFF", text: "#FFFFFF", size: 10 };
}

export default function MaharashtraCollegeMap({
  colleges,
  selectedCode,
  onSelect,
  scoreMode,
  tileStyle,
  userLocation,
  focusTarget,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [19.15, 75.35],
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const cfg = TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // Switch tile layer (OSM / Esri Street / Satellite) dynamically with zero API key
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const cfg = TILE_LAYERS[tileStyle] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [tileStyle]);

  // Fly to city/college focus target
  useEffect(() => {
    if (!mapRef.current || !focusTarget) return;
    mapRef.current.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom, {
      duration: 0.75,
    });
  }, [focusTarget]);

  // Render user GPS location marker if enabled
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (!userLocation) return;

    const userIcon = L.divIcon({
      className: "cap-user-pin",
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(37,99,235,0.28);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const m = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      zIndexOffset: 2000,
    })
      .bindTooltip("Your Current Location", { direction: "top", offset: [0, -10] })
      .addTo(map);
    userMarkerRef.current = m;
  }, [userLocation]);

  // Render college markers efficiently
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const c of colleges) {
      const isSelected = selectedCode === c.college_code;
      const { bg, ring, size } = getPinColors(c, scoreMode, isSelected);
      const borderW = isSelected ? 3 : 2;
      const shadow = isSelected
        ? "0 0 0 6px rgba(37,99,235,0.35), 0 4px 12px rgba(15,23,42,0.45)"
        : "0 2px 6px rgba(15,23,42,0.28)";

      const icon = L.divIcon({
        className: "cap-college-pin",
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:${borderW}px solid ${ring};box-shadow:${shadow};transition:transform 120ms ease;cursor:pointer;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const pctLabel = scoreMode
        ? c.matched_percentile != null
          ? `${c.matched_percentile.toFixed(2)}%ile`
          : ""
        : c.top_cutoff_percentile != null
        ? `${c.top_cutoff_percentile.toFixed(2)}%ile`
        : "";

      const distLabel =
        c.distance_km != null ? ` • ${c.distance_km.toFixed(1)} km` : "";

      const tooltipHtml = `<div style="font-family:system-ui,sans-serif;font-size:11px;line-height:1.35;max-width:230px;">
        <div style="font-weight:700;color:#0F172A;">${c.college_name.replace(/</g, "&lt;")}</div>
        <div style="color:#475569;margin-top:2px;">DTE ${c.college_code} • ${c.city}${distLabel}</div>
        ${
          pctLabel
            ? `<div style="color:#2563EB;font-weight:700;margin-top:2px;">${
                scoreMode ? c.prediction_category : "Top Cutoff"
              }: ${pctLabel}</div>`
            : ""
        }
      </div>`;

      const marker = L.marker([c.lat, c.lng], {
        icon,
        zIndexOffset: isSelected ? 1500 : c.nirf_median_lpa != null ? 500 : 100,
      });
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -Math.ceil(size / 2) - 2],
        opacity: 0.98,
      });
      marker.on("click", () => onSelect(c));
      marker.addTo(layer);
    }
  }, [colleges, selectedCode, scoreMode, onSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[480px] z-0"
      aria-label="Interactive Maharashtra Engineering Colleges Map"
    />
  );
}
