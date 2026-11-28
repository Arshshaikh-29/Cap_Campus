"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Radar,
  TrendingDown,
  Flame,
  Sparkles,
  Lock,
  Crown,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight,
  Globe,
  ExternalLink,
  Bookmark,
  BookOpen,
  MapPin,
  ShieldCheck,
  Info,
} from "lucide-react";
import { formatCategory } from "@/lib/categories";
import {
  GPAY_NUMBER,
  PlanSession,
  escapeCSVCell,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const BRANCH_OPTIONS = [
  "Computer Engineering",
  "Information Technology",
  "Computer Science and Engineering",
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Electronics and Telecommunication Engg",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
];

const CITY_OPTIONS = [
  "Pune",
  "Mumbai",
  "Navi Mumbai",
  "Thane",
  "Nagpur",
  "Nashik",
  "Chhatrapati Sambhajinagar",
  "Kolhapur",
  "Sangli",
];

export default function BettermentRadarPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("96.50");
  const [rank, setRank] = useState("12000");
  const [category, setCategory] = useState("GOPENS");
  const [branches, setBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
    "Electronics and Telecommunication Engg",
  ]);
  const [cities, setCities] = useState<string[]>(["Pune", "Mumbai", "Navi Mumbai"]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"gems" | "spot" | "drops">("gems");
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  const proActive = isProActive(planSession);

  const runRadarWith = async (
    opts: {
      mode: "percentile" | "rank";
      pct: string;
      rnk: string;
      cat: string;
      br: string[];
      ct: string[];
    },
    token?: string
  ) => {
    setError("");
    const payload: Record<string, unknown> = {
      category: opts.cat,
      branches: opts.br.length ? opts.br : null,
      cities: opts.ct.length ? opts.ct : null,
    };
    if (opts.mode === "percentile") {
      const v = parseFloat(opts.pct);
      if (isNaN(v) || v <= 0 || v > 100) {
        setError("Enter a valid percentile between 0 and 100.");
        return;
      }
      payload.percentile = v;
    } else {
      const v = parseFloat(opts.rnk);
      if (isNaN(v) || v < 1) {
        setError("Enter a valid State Merit Rank.");
        return;
      }
      payload.rank = v;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const activeTok = token ?? getStoredPlan().entitlementToken;
      if (activeTok) {
        headers["X-Entitlement-Token"] = activeTok;
      }
      const res = await axios.post(`${API_BASE}/betterment-radar`, payload, {
        headers,
      });
      setData(res.data);
    } catch (err: any) {
      setError(
        err?.response?.status === 429
          ? "Too many requests. Please wait a minute before scanning again."
          : err?.response?.data?.detail || "Could not scan CAP Round 1–3 betterment drops."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);

    const syncPlan = () => {
      const next = getStoredPlan();
      setPlanSession(next);
    };
    const syncBm = () => setBookmarks(getStoredBookmarks());
    syncPlan();
    syncBm();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get("p");
      const rParam = params.get("r");
      const catParam = params.get("cat");
      const bParam = params.get("b");
      const cParam = params.get("c");
      if (pParam || rParam) {
        const mode: "percentile" | "rank" = rParam && !pParam ? "rank" : "percentile";
        const pct = pParam || percentile;
        const rnk = rParam || rank;
        const cat = (catParam || "GOPENS").toUpperCase();
        const br = bParam ? bParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const ct = cParam ? cParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
        setInputType(mode);
        if (pParam) setPercentile(pParam);
        if (rParam) setRank(rParam);
        setCategory(cat);
        setBranches(br);
        setCities(ct);
        runRadarWith({ mode, pct, rnk, cat, br, ct });
      }
    }

    window.addEventListener("cap_plan_updated", syncPlan);
    window.addEventListener("cap_bookmarks_updated", syncBm);
    return () => {
      window.removeEventListener("cap_plan_updated", syncPlan);
      window.removeEventListener("cap_bookmarks_updated", syncBm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch automatically when user activates Pro so server immediately unlocks all hidden rows
  useEffect(() => {
    if (data && proActive && !data.is_pro) {
      runRadarWith(
        { mode: inputType, pct: percentile, rnk: rank, cat: category, br: branches, ct: cities },
        planSession.entitlementToken
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proActive]);

  const toggle = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const toggleBookmark = (row: any) => {
    const key = `${row.college_code}|${row.branch}`;
    const existing = getStoredBookmarks();
    if (existing.some((b) => b.key === key)) {
      saveStoredBookmarks(existing.filter((b) => b.key !== key));
    } else {
      saveStoredBookmarks([
        ...existing,
        {
          key,
          college_code: row.college_code,
          college_name: row.college_name,
          city: row.city,
          branch: row.branch,
          historical_percentile: row.final_percentile,
          historical_rank: row.final_rank,
          prediction_category: "Betterment Gem",
        },
      ]);
    }
  };

  const activeRows: any[] =
    activeTab === "gems"
      ? data?.betterment_gems || []
      : activeTab === "spot"
      ? data?.spot_watchlist || []
      : data?.biggest_drops || [];

  const exportCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export the full Betterment & Spot-Round Drop Radar sheet to CSV with CAP Pro Pass"
      );
      return;
    }
    if (!activeRows.length) return;
    const headers = [
      "College_Code",
      "Choice_Code",
      "College_Name",
      "City",
      "Branch",
      "Year",
      "Basis_Category",
      "Round1_Percentile",
      "Round2_Percentile",
      "Round3_Percentile",
      "Round4_Percentile",
      "Final_Round",
      "R1_to_Final_Drop_Pct",
      "Rank_Relaxation",
      "Verdict",
      "Official_Website",
    ];
    const rows = activeRows.map((r) =>
      [
        r.college_code,
        r.choice_code || "",
        r.college_name,
        r.city,
        r.branch,
        r.year,
        r.basis_category,
        r.r1_percentile,
        r.r2_percentile ?? "",
        r.r3_percentile ?? "",
        r.r4_percentile ?? "",
        r.final_round ?? "",
        r.drop_percentile,
        r.rank_relaxation,
        r.verdict,
        r.official_website || r.cet_portal_url || "",
      ]
        .map(escapeCSVCell)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_Betterment_Radar_${category}_${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bookmarkedKeys = new Set(bookmarks.map((b) => b.key));
  const lockedForCurrentTab =
    activeTab === "gems"
      ? data?.summary?.locked_betterment_count || 0
      : activeTab === "spot"
      ? data?.summary?.locked_spot_count || 0
      : 0;

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
              Betterment &amp; Spot-Round Radar
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Colleges missed in Round 1 that historically drop into reach in Rounds 2–4.
            </p>
          </div>
          {!proActive && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal(
                  "pro",
                  "Unlock ALL Betterment Gems, the complete Spot/ACAP Watchlist & CSV export with CAP Pro Pass"
                )
              }
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Crown size={15} /> Unlock Full Radar • ₹199 (GPay {GPAY_NUMBER})
            </button>
          )}
        </div>

        {/* Config Card */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Your MHT-CET Score
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                  {(["percentile", "rank"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInputType(t)}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        inputType === t
                          ? "bg-white text-[#172554] shadow-2xs"
                          : "text-slate-500"
                      }`}
                    >
                      {t === "percentile" ? "%ile" : "Rank"}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step={inputType === "percentile" ? "0.01" : "1"}
                value={inputType === "percentile" ? percentile : rank}
                onChange={(e) =>
                  inputType === "percentile"
                    ? setPercentile(e.target.value)
                    : setRank(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  runRadarWith({
                    mode: inputType,
                    pct: percentile,
                    rnk: rank,
                    cat: category,
                    br: branches,
                    ct: cities,
                  })
                }
                className="w-full px-4 py-3 text-lg font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
              />
            </div>

            <div className="md:col-span-5 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reservation Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
              >
                {(categories.length ? categories : ["GOPENS"]).map((c) => (
                  <option key={c} value={c}>
                    {formatCategory(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-end">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  runRadarWith({
                    mode: inputType,
                    pct: percentile,
                    rnk: rank,
                    cat: category,
                    br: branches,
                    ct: cities,
                  })
                }
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-slate-300 text-white font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Radar size={16} />
                )}
                {loading ? "Scanning R1–R3..." : "Scan Betterment Gems"}
              </button>
            </div>
          </div>

          {/* Multi-Branch & Multi-City */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen size={12} /> Branches{" "}
                <span className="normal-case font-medium text-slate-400">
                  ({branches.length ? `${branches.length} selected` : "all branches"})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BRANCH_OPTIONS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggle(branches, setBranches, b)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      branches.includes(b)
                        ? "bg-electric-blue/10 border-electric-blue/40 text-electric-blue"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin size={12} /> Cities{" "}
                <span className="normal-case font-medium text-slate-400">
                  ({cities.length ? `${cities.length} selected` : "all of Maharashtra"})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(cities, setCities, c)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      cities.includes(c)
                        ? "bg-electric-blue/10 border-electric-blue/40 text-electric-blue"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        {!data && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
            <Radar size={28} className="mx-auto text-electric-blue" />
            <div className="text-sm font-bold text-[#172554]">
              Discover Hidden Round 2 &amp; Round 3 Betterment Upgrades
            </div>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              Enter your MHT-CET score and press <strong>Scan Betterment Gems</strong>{" "}
              to see exact historical Round 1 → Round 2 → Round 3 cutoff drops
              across Maharashtra engineering colleges.
            </p>
          </div>
        )}

        {data && (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Sparkles size={13} /> Betterment Gems Found
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 mt-1.5">
                  {data.summary.total_betterment_gems}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Missed R1 but dropped into reach by R2–R4
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <Flame size={13} /> Spot / ACAP Watchlist
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 mt-1.5">
                  {data.summary.total_spot_watchlist}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Just 0.35–2.2 %ile above final CAP round
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <TrendingDown size={13} /> Avg R1 → R4 Drop
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-indigo-600 mt-1.5">
                  −{Number(data.summary.avg_gem_drop_percentile || 0).toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Max observed drop: −{Number(data.summary.max_drop_percentile || 0).toFixed(2)} %ile
                </div>
              </div>

              <div className="bg-[#172554] text-white rounded-2xl p-5 flex flex-col justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#C7D2FE] flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Your Profile ({data.student.rank_scale_year})
                </div>
                <div className="text-xl font-extrabold font-mono tabular-nums mt-1">
                  {Number(data.student.percentile).toFixed(2)} %ile • #
                  {Number(data.student.rank).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Access Tier:{" "}
                  <strong className={data.is_pro ? "text-emerald-400" : "text-amber-300"}>
                    {data.is_pro ? `${data.tier.toUpperCase()} UNLOCKED` : "FREE PREVIEW"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tabs & Actions */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      id: "gems" as const,
                      label: `Betterment Gems (${data.summary.total_betterment_gems})`,
                    },
                    {
                      id: "spot" as const,
                      label: `Spot / ACAP Watchlist (${data.summary.total_spot_watchlist})`,
                    },
                    {
                      id: "drops" as const,
                      label: `Biggest R1→R4 Drops (${data.summary.total_biggest_drops})`,
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === t.id
                          ? "bg-[#172554] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} className="text-amber-600" />}
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Export CSV
                  </button>
                  <Link
                    href={`/option-form?p=${data.student.percentile}&cat=${data.student.category}`}
                    className="px-3.5 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    Build Option Form <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {activeRows.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No colleges matched this tab for your current filters. Try
                  clearing city/branch filters to scan all of Maharashtra.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeRows.map((r, idx) => {
                    const saved = bookmarkedKeys.has(`${r.college_code}|${r.branch}`);
                    return (
                      <div
                        key={`${r.college_code}-${r.branch}-${idx}`}
                        className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              DTE {r.college_code}
                            </span>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Drop: −{Number(r.drop_percentile).toFixed(2)} %ile (+
                              {Number(r.rank_relaxation).toLocaleString()} ranks)
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {r.city} • {r.year} ({r.basis_category})
                            </span>
                          </div>

                          <Link
                            href={`/college/${r.college_code}`}
                            className="block text-base font-bold text-[#172554] hover:text-electric-blue transition-colors"
                          >
                            {r.college_name}
                          </Link>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-electric-blue">
                              {r.branch}
                            </span>
                            {(r.official_website || r.cet_portal_url) && (
                              <a
                                href={r.official_website || r.cet_portal_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 hover:text-electric-blue hover:underline"
                              >
                                <Globe size={11} /> {r.website_domain || "CET Profile"}
                                <ExternalLink size={9} />
                              </a>
                            )}
                            {r.nirf_median_lpa != null && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                NIRF: ₹{Number(r.nirf_median_lpa).toFixed(1)}L
                              </span>
                            )}
                            {r.annual_fee_inr != null && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Fee: ₹{(r.annual_fee_inr / 100000).toFixed(2)}L/yr
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-semibold text-slate-700 pt-0.5">
                            Verdict: <span className="text-indigo-700">{r.verdict}</span>
                          </div>
                        </div>

                        {/* R1 -> R2 -> R3 -> R4 Progression Box */}
                        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono tabular-nums text-xs">
                            <div className="text-center">
                              <div className="text-[9px] font-bold uppercase text-slate-400">
                                Round 1
                              </div>
                              <div className="font-bold text-rose-600">
                                {Number(r.r1_percentile).toFixed(2)}%
                              </div>
                            </div>
                            <span className="text-slate-300 font-bold">→</span>
                            {r.r2_percentile != null && r.final_round !== 2 && (
                              <>
                                <div className="text-center">
                                  <div className="text-[9px] font-bold uppercase text-slate-400">
                                    Round 2
                                  </div>
                                  <div className="font-bold text-amber-600">
                                    {Number(r.r2_percentile).toFixed(2)}%
                                  </div>
                                </div>
                                <span className="text-slate-300 font-bold">→</span>
                              </>
                            )}
                            {r.r3_percentile != null && r.final_round === 4 && (
                              <>
                                <div className="text-center">
                                  <div className="text-[9px] font-bold uppercase text-slate-400">
                                    Round 3
                                  </div>
                                  <div className="font-bold text-blue-600">
                                    {Number(r.r3_percentile).toFixed(2)}%
                                  </div>
                                </div>
                                <span className="text-slate-300 font-bold">→</span>
                              </>
                            )}
                            <div className="text-center">
                              <div className="text-[9px] font-bold uppercase text-slate-400">
                                {r.final_round
                                  ? `Round ${r.final_round}`
                                  : r.r4_percentile != null
                                  ? "Round 4"
                                  : r.r3_percentile != null
                                  ? "Round 3"
                                  : "Final"}
                              </div>
                              <div className="font-extrabold text-emerald-700">
                                {Number(r.final_percentile).toFixed(2)}%
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleBookmark(r)}
                            title={saved ? "Remove from Shortlist" : "Save Betterment Target"}
                            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                              saved
                                ? "bg-electric-blue/10 border-electric-blue/30 text-electric-blue"
                                : "bg-white border-slate-200 text-slate-500 hover:text-[#172554]"
                            }`}
                          >
                            <Bookmark size={15} className={saved ? "fill-electric-blue" : ""} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Server-Enforced Pro Paywall Card */}
              {!data.is_pro && lockedForCurrentTab > 0 && (
                <div className="p-6 bg-gradient-to-r from-[#172554] via-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <Lock size={13} /> {lockedForCurrentTab} More{" "}
                      {activeTab === "gems" ? "Betterment Gems" : "Spot Round Targets"}{" "}
                      Protected by CAP Pro
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Unlock every single Round 1 → Round 3 upgrade opportunity,
                      the complete Spot/ACAP Round watchlist, 60-choice Smart
                      Option Form &amp; CSV exports for a one-time ₹199 via GPay ({GPAY_NUMBER}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal(
                        "pro",
                        `Unlock all ${lockedForCurrentTab} remaining Betterment & Spot Round targets with CAP Pro Pass`
                      )
                    }
                    className="px-5 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer"
                  >
                    <Crown size={14} /> Unlock All Now • ₹199
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[#EEF2FF]/70 border border-blue-100 text-xs text-slate-700">
              <Info size={15} className="text-electric-blue shrink-0 mt-0.5" />
              <span>
                Betterment drops are calculated directly from official State CET
                Cell CAP Round 1, Round 2, Round 3 &amp; Round 4 cutoff lists
                (2023–2026). Always keep Dream betterment choices placed{" "}
                <strong>above</strong> your Round 1 allotted seat and choose{" "}
                <strong>Not Freeze / Betterment</strong>.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
