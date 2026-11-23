"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import axios from "axios";
import {
  Map as MapIcon,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Bookmark,
  Globe,
  ExternalLink,
  Compass,
  RefreshCw,
  X,
  Crosshair,
  Building2,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import type { MapCollegeItem } from "@/components/MaharashtraCollegeMap";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";
import { formatCategory } from "@/lib/categories";

const MaharashtraCollegeMap = dynamic(
  () => import("@/components/MaharashtraCollegeMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[520px] bg-slate-100 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs font-semibold">
        <RefreshCw size={22} className="animate-spin text-electric-blue" />
        Loading Interactive Maharashtra College Map...
      </div>
    ),
  }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const CITY_VIEWS: { label: string; city: string; lat: number; lng: number; zoom: number }[] = [
  { label: "All Maharashtra", city: "", lat: 19.15, lng: 75.35, zoom: 7 },
  { label: "Mumbai", city: "Mumbai", lat: 19.08, lng: 72.86, zoom: 11 },
  { label: "Pune", city: "Pune", lat: 18.54, lng: 73.84, zoom: 11 },
  { label: "Navi Mumbai", city: "Navi Mumbai", lat: 19.04, lng: 73.04, zoom: 12 },
  { label: "Nagpur", city: "Nagpur", lat: 21.12, lng: 79.05, zoom: 11 },
  { label: "Nashik", city: "Nashik", lat: 20.00, lng: 73.80, zoom: 11 },
  { label: "Chh. Sambhajinagar", city: "Chhatrapati Sambhajinagar", lat: 19.87, lng: 75.34, zoom: 12 },
  { label: "Kolhapur", city: "Kolhapur", lat: 16.71, lng: 74.28, zoom: 11 },
  { label: "Sangli", city: "Sangli", lat: 16.92, lng: 74.49, zoom: 11 },
];

const POPULAR_BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "Computer Science and Engineering",
  "Artificial Intelligence and Data Science",
  "Electronics and Telecommunication Engg",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function CollegeMapPage() {
  const [colleges, setColleges] = useState<MapCollegeItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Mode & filters
  const [scoreMode, setScoreMode] = useState(false);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [scoreVal, setScoreVal] = useState("96.50");
  const [category, setCategory] = useState("GOPENS");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [insightsOnly, setInsightsOnly] = useState(false);
  const [bandFilter, setBandFilter] = useState<string>("All");

  // Selection, GPS & camera
  const [selected, setSelected] = useState<MapCollegeItem | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    nonce: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  const fetchMapData = useCallback(
    async (opts: {
      useScore: boolean;
      mode: "percentile" | "rank";
      score: string;
      cat: string;
      cityFilter: string;
      branchFilter: string;
      insights: boolean;
      initialFocusCode?: string | null;
    }) => {
      setLoading(true);
      try {
        const params: Record<string, string | number | boolean> = {};
        if (opts.cityFilter) params.city = opts.cityFilter;
        if (opts.branchFilter) params.branch = opts.branchFilter;
        if (opts.insights) params.insights_only = true;
        if (opts.useScore) {
          const num = parseFloat(opts.score);
          if (!isNaN(num) && num > 0) {
            if (opts.mode === "percentile" && num <= 100) {
              params.percentile = num;
            } else if (opts.mode === "rank") {
              params.rank = num;
            }
            params.category = opts.cat || "GOPENS";
          }
        }
        const res = await axios.get(`${API_BASE}/map/colleges`, { params });
        const list: MapCollegeItem[] = res.data?.colleges || [];
        setColleges(list);
        setSummary(res.data?.summary || null);

        if (opts.initialFocusCode) {
          const found = list.find(
            (c) => c.college_code === opts.initialFocusCode
          );
          if (found) {
            setSelected(found);
            setFocusTarget({
              lat: found.lat,
              lng: found.lng,
              zoom: 14,
              nonce: Date.now(),
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch map colleges", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data?.categories || []))
      .catch(() => undefined);

    const syncBm = () => setBookmarks(getStoredBookmarks());
    syncBm();
    window.addEventListener("cap_bookmarks_updated", syncBm);

    // Read optional URL params (?college=3012 or ?p=96.5&cat=GOPENS&b=...&c=...)
    let initScoreMode = false;
    let initMode: "percentile" | "rank" = "percentile";
    let initScore = "96.50";
    let initCat = "GOPENS";
    let initCity = "";
    let initBranch = "";
    let initCollege: string | null = null;

    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const p = qs.get("p");
      const r = qs.get("r");
      const cat = qs.get("cat");
      const b = qs.get("b");
      const c = qs.get("c");
      const col = qs.get("college");

      if (p || r) {
        initScoreMode = true;
        initMode = r && !p ? "rank" : "percentile";
        initScore = p || r || "96.50";
        setScoreMode(true);
        setInputType(initMode);
        setScoreVal(initScore);
      }
      if (cat) {
        initCat = cat.toUpperCase();
        setCategory(initCat);
      }
      if (b) {
        initBranch = b.split(",")[0].trim();
        setBranch(initBranch);
      }
      if (c) {
        initCity = c.split(",")[0].trim();
        setCity(initCity);
      }
      if (col) {
        initCollege = col.trim();
      }
    }

    fetchMapData({
      useScore: initScoreMode,
      mode: initMode,
      score: initScore,
      cat: initCat,
      cityFilter: initCity,
      branchFilter: initBranch,
      insights: false,
      initialFocusCode: initCollege,
    });

    return () => window.removeEventListener("cap_bookmarks_updated", syncBm);
  }, [fetchMapData]);

  const enrichedColleges = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = colleges.map((c) => ({
      ...c,
      distance_km: userLocation
        ? haversineKm(userLocation.lat, userLocation.lng, c.lat, c.lng)
        : null,
    }));

    if (q) {
      list = list.filter(
        (c) =>
          c.college_name.toLowerCase().includes(q) ||
          c.college_code.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q)
      );
    }

    if (scoreMode && bandFilter !== "All") {
      list = list.filter((c) => c.prediction_category === bandFilter);
    }

    if (userLocation) {
      list.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    } else if (scoreMode) {
      const order: Record<string, number> = {
        "Historically Within Range": 0,
        Moderate: 1,
        Ambitious: 2,
      };
      list.sort((a, b) => {
        const oa = order[a.prediction_category || ""] ?? 9;
        const ob = order[b.prediction_category || ""] ?? 9;
        if (oa !== ob) return oa - ob;
        return (a.matched_rank ?? 1e9) - (b.matched_rank ?? 1e9);
      });
    } else {
      list.sort(
        (a, b) =>
          (b.top_cutoff_percentile ?? 0) - (a.top_cutoff_percentile ?? 0)
      );
    }
    return list;
  }, [colleges, search, scoreMode, bandFilter, userLocation]);

  const handleSelectCollege = useCallback((c: MapCollegeItem) => {
    setSelected(c);
    setFocusTarget({ lat: c.lat, lng: c.lng, zoom: 14, nonce: Date.now() });
  }, []);

  const handleCityQuickJump = (view: (typeof CITY_VIEWS)[number]) => {
    setCity(view.city);
    setSelected(null);
    setFocusTarget({
      lat: view.lat,
      lng: view.lng,
      zoom: view.zoom,
      nonce: Date.now(),
    });
    fetchMapData({
      useScore: scoreMode,
      mode: inputType,
      score: scoreVal,
      cat: category,
      cityFilter: view.city,
      branchFilter: branch,
      insights: insightsOnly,
    });
  };

  const handleLocateMe = () => {
    setLocError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setFocusTarget({ lat: loc.lat, lng: loc.lng, zoom: 11, nonce: Date.now() });
        setLocating(false);
      },
      () => {
        setLocError("Location permission denied. You can still pick any Maharashtra city above.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const bookmarkedCodes = useMemo(
    () => new Set(bookmarks.map((b) => b.college_code)),
    [bookmarks]
  );

  const toggleBookmark = (c: MapCollegeItem) => {
    const existing = getStoredBookmarks();
    if (existing.some((b) => b.college_code === c.college_code)) {
      saveStoredBookmarks(
        existing.filter((b) => b.college_code !== c.college_code)
      );
    } else {
      const br = c.matched_branch || c.top_branch || "All Branches";
      saveStoredBookmarks([
        ...existing,
        {
          key: `${c.college_code}|${br}`,
          college_code: c.college_code,
          college_name: c.college_name,
          city: c.city,
          branch: br,
          historical_percentile:
            c.matched_percentile ?? c.top_cutoff_percentile ?? undefined,
          historical_rank: c.matched_rank ?? c.top_cutoff_rank ?? undefined,
          prediction_category: c.prediction_category,
        },
      ]);
    }
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] flex flex-col">
      {/* Top Map Control Bar */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-4">
        <div className="max-w-[1600px] mx-auto space-y-3">
          {/* Row 1: Title + Mode Switch + Locate Me */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-electric-blue/10 border border-electric-blue/20 text-electric-blue flex items-center justify-center shrink-0">
                <MapIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                    Maharashtra Engineering College Map
                  </h1>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {enrichedColleges.length} Pins Live
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Explore 400 DTE colleges geographically, check distance from
                  home, or color-code every campus by your MHT-CET score.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Browse vs Score Match Mode */}
              <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setScoreMode(false);
                    setBandFilter("All");
                    fetchMapData({
                      useScore: false,
                      mode: inputType,
                      score: scoreVal,
                      cat: category,
                      cityFilter: city,
                      branchFilter: branch,
                      insights: insightsOnly,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    !scoreMode
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All 400 Colleges
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScoreMode(true);
                    fetchMapData({
                      useScore: true,
                      mode: inputType,
                      score: scoreVal,
                      cat: category,
                      cityFilter: city,
                      branchFilter: branch,
                      insights: insightsOnly,
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    scoreMode
                      ? "bg-electric-blue text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Sparkles size={12} /> Score Match Map
                </button>
              </div>

              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                  userLocation
                    ? "bg-blue-50 border-electric-blue/40 text-electric-blue"
                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <Crosshair
                  size={14}
                  className={locating ? "animate-spin text-electric-blue" : "text-electric-blue"}
                />
                {locating
                  ? "Locating..."
                  : userLocation
                  ? "Sorted by Distance"
                  : "Near Me"}
              </button>
            </div>
          </div>

          {/* Row 2: City Quick Jump Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Jump to Region:
            </span>
            {CITY_VIEWS.map((v) => {
              const active = city === v.city;
              return (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => handleCityQuickJump(v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                    active
                      ? "bg-[#0B1120] text-white border-[#0B1120]"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Row 3: Search + Branch + Insights + Optional Score Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[210px]">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search college name, DTE code (e.g. 3012, 6006), or city..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:bg-white focus:border-electric-blue"
              />
            </div>

            <select
              aria-label="Filter by branch"
              value={branch}
              onChange={(e) => {
                const nextBr = e.target.value;
                setBranch(nextBr);
                fetchMapData({
                  useScore: scoreMode,
                  mode: inputType,
                  score: scoreVal,
                  cat: category,
                  cityFilter: city,
                  branchFilter: nextBr,
                  insights: insightsOnly,
                });
              }}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-electric-blue"
            >
              <option value="">All Branches</option>
              {POPULAR_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const next = !insightsOnly;
                setInsightsOnly(next);
                fetchMapData({
                  useScore: scoreMode,
                  mode: inputType,
                  score: scoreVal,
                  cat: category,
                  cityFilter: city,
                  branchFilter: branch,
                  insights: next,
                });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                insightsOnly
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal size={12} />
              NIRF &amp; FRA Verified Only
            </button>

            {scoreMode && (
              <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-slate-200">
                <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setInputType((t) =>
                        t === "percentile" ? "rank" : "percentile"
                      )
                    }
                    className="px-2 py-1 text-[11px] font-mono font-bold bg-white rounded-lg border border-slate-200 text-slate-800 cursor-pointer"
                  >
                    {inputType === "percentile" ? "%ile" : "Rank"}
                  </button>
                  <input
                    type="number"
                    step={inputType === "percentile" ? "0.01" : "1"}
                    value={scoreVal}
                    onChange={(e) => setScoreVal(e.target.value)}
                    className="w-20 px-2 py-1 text-xs font-mono font-bold bg-transparent focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 max-w-[160px]"
                >
                  {(categories.length ? categories : ["GOPENS"]).map((c) => (
                    <option key={c} value={c}>
                      {formatCategory(c)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    fetchMapData({
                      useScore: true,
                      mode: inputType,
                      score: scoreVal,
                      cat: category,
                      cityFilter: city,
                      branchFilter: branch,
                      insights: insightsOnly,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Compass size={13} /> Map My Score
                </button>
              </div>
            )}
          </div>

          {/* Score Match Band Filter Strip */}
          {scoreMode && summary && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {[
                { id: "All", label: `All Matches (${summary.total})`, cls: "bg-slate-900 text-white" },
                {
                  id: "Historically Within Range",
                  label: `Within Range (${summary.within_range})`,
                  dot: "bg-emerald-500",
                },
                {
                  id: "Moderate",
                  label: `Moderate (${summary.moderate})`,
                  dot: "bg-amber-500",
                },
                {
                  id: "Ambitious",
                  label: `Ambitious (${summary.ambitious})`,
                  dot: "bg-rose-500",
                },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBandFilter(b.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                    bandFilter === b.id
                      ? "bg-[#0B1120] text-white border-[#0B1120]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {b.dot && <span className={`w-2 h-2 rounded-full ${b.dot}`} />}
                  {b.label}
                </button>
              ))}
            </div>
          )}

          {locError && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {locError}
            </div>
          )}
        </div>
      </div>

      {/* Main Split Map Workspace */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        {/* Left Sidebar List */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white border-r border-slate-200/90 flex flex-col max-h-[380px] lg:max-h-[calc(100vh-220px)] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              {loading ? "Loading campuses..." : `${enrichedColleges.length} Institutes`}
            </span>
            <span className="text-[11px] text-slate-400">
              {userLocation ? "Closest first" : "Click pin or card"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {enrichedColleges.length === 0 && !loading ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <Building2 size={24} className="mx-auto text-slate-300" />
                <div>No colleges match these map filters.</div>
              </div>
            ) : (
              enrichedColleges.slice(0, 120).map((c) => {
                const isSel = selected?.college_code === c.college_code;
                const bandDot =
                  c.prediction_category === "Historically Within Range"
                    ? "bg-emerald-500"
                    : c.prediction_category === "Moderate"
                    ? "bg-amber-500"
                    : c.prediction_category === "Ambitious"
                    ? "bg-rose-500"
                    : c.nirf_median_lpa != null
                    ? "bg-electric-blue"
                    : "bg-slate-400";

                return (
                  <button
                    key={c.college_code}
                    type="button"
                    onClick={() => handleSelectCollege(c)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                      isSel
                        ? "bg-electric-blue/[0.08] border-l-4 border-l-electric-blue"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] mb-1">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-600">
                        <span className={`w-2 h-2 rounded-full ${bandDot}`} />
                        DTE {c.college_code} • {c.city}
                      </span>
                      {c.distance_km != null && (
                        <span className="font-mono font-bold text-electric-blue bg-blue-50 px-1.5 py-0.5 rounded">
                          {c.distance_km < 10
                            ? `${c.distance_km.toFixed(1)} km`
                            : `${Math.round(c.distance_km)} km`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {c.college_name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] font-mono">
                      {(scoreMode ? c.matched_percentile : c.top_cutoff_percentile) != null && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">
                          {Number(
                            scoreMode ? c.matched_percentile : c.top_cutoff_percentile
                          ).toFixed(2)}
                          %ile
                        </span>
                      )}
                      {c.nirf_median_lpa != null && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                          NIRF ₹{Number(c.nirf_median_lpa).toFixed(1)}L
                        </span>
                      )}
                      {c.annual_fee_inr != null && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                          ₹{(c.annual_fee_inr / 100000).toFixed(2)}L/yr
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Interactive Leaflet Map + Floating Overlay Card */}
        <div className="lg:col-span-8 xl:col-span-9 relative min-h-[520px] lg:min-h-[calc(100vh-220px)]">
          <MaharashtraCollegeMap
            colleges={enrichedColleges}
            selectedCode={selected?.college_code || null}
            onSelect={handleSelectCollege}
            scoreMode={scoreMode}
            userLocation={userLocation}
            focusTarget={focusTarget}
          />

          {/* Floating Legend (Top Right) */}
          <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-2.5 shadow-md text-[11px] space-y-1">
            <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
              Map Legend
            </div>
            {scoreMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Within Range
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Ambitious
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-electric-blue" /> Top NIRF/FRA Verified
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> DTE Institute
                </span>
              </div>
            )}
          </div>

          {/* Floating Selected College Detail Card (Bottom Left) */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[410px] z-[400] bg-white rounded-2xl border border-slate-200/90 shadow-2xl p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                    <span className="bg-[#0B1120] text-white px-2 py-0.5 rounded">
                      DTE {selected.college_code}
                    </span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
                      <MapPin size={10} className="text-electric-blue" />
                      {selected.city}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        selected.is_exact_campus
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {selected.is_exact_campus ? "Exact Campus Pin" : "Locality Area Pin"}
                    </span>
                    {selected.distance_km != null && (
                      <span className="bg-blue-50 text-electric-blue px-2 py-0.5 rounded">
                        {selected.distance_km.toFixed(1)} km away
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                    {selected.college_name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer shrink-0"
                  aria-label="Close college card"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[9px] font-bold uppercase text-slate-400">
                    {scoreMode ? "Match Cutoff" : "Top Cutoff"}
                  </div>
                  <div className="text-xs font-extrabold font-mono text-slate-900 mt-0.5">
                    {(scoreMode
                      ? selected.matched_percentile
                      : selected.top_cutoff_percentile) != null
                      ? `${Number(
                          scoreMode
                            ? selected.matched_percentile
                            : selected.top_cutoff_percentile
                        ).toFixed(2)}%`
                      : "N/A"}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                  <div className="text-[9px] font-bold uppercase text-emerald-700">
                    NIRF Median
                  </div>
                  <div className="text-xs font-extrabold font-mono text-emerald-800 mt-0.5">
                    {selected.nirf_median_lpa != null
                      ? `₹${Number(selected.nirf_median_lpa).toFixed(1)} LPA`
                      : "See Portal"}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                  <div className="text-[9px] font-bold uppercase text-indigo-700">
                    Annual Fee
                  </div>
                  <div className="text-xs font-extrabold font-mono text-indigo-800 mt-0.5">
                    {selected.annual_fee_inr != null
                      ? `₹${(selected.annual_fee_inr / 100000).toFixed(2)}L/yr`
                      : "See FRA"}
                  </div>
                </div>
              </div>

              {(selected.matched_branch || selected.top_branch) && (
                <div className="text-[11px] text-slate-600 truncate">
                  {scoreMode ? "Best Match: " : "Top Branch: "}
                  <strong className="text-electric-blue">
                    {selected.matched_branch || selected.top_branch}
                  </strong>{" "}
                  ({selected.branches_count} branches)
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={selected.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Navigation size={13} /> Directions
                  <ExternalLink size={10} />
                </a>
                <Link
                  href={`/college/${selected.college_code}`}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  Full Profile <ArrowRight size={12} />
                </Link>
                {selected.official_website && (
                  <a
                    href={selected.official_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Official College Website"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    <Globe size={14} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggleBookmark(selected)}
                  title={
                    bookmarkedCodes.has(selected.college_code)
                      ? "Remove from Shortlist"
                      : "Save to Shortlist"
                  }
                  className={`p-2 rounded-xl border cursor-pointer ${
                    bookmarkedCodes.has(selected.college_code)
                      ? "bg-electric-blue/10 border-electric-blue/30 text-electric-blue"
                      : "bg-slate-100 border-slate-200 text-slate-600"
                  }`}
                >
                  <Bookmark
                    size={14}
                    className={
                      bookmarkedCodes.has(selected.college_code)
                        ? "fill-electric-blue"
                        : ""
                    }
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
