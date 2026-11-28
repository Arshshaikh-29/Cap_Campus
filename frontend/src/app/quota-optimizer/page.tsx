"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Award,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Layers,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";
import { showToast } from "@/components/ui/ToastProvider";
import { getStoredAuth } from "@/lib/auth";
import {
  GPAY_NUMBER,
  PlanSession,
  escapeCSVCell,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const BASE_CATEGORIES = [
  { code: "GOPENS", label: "OPEN (General)" },
  { code: "GOBCS", label: "OBC" },
  { code: "GSEBCS", label: "SEBC (Maratha)" },
  { code: "EWS", label: "EWS" },
  { code: "GSCS", label: "SC" },
  { code: "GSTS", label: "ST" },
  { code: "GVJS", label: "VJ / DT(A)" },
  { code: "GNT1S", label: "NT-1 (NT-B)" },
  { code: "GNT2S", label: "NT-2 (NT-C)" },
  { code: "GNT3S", label: "NT-3 (NT-D)" },
  { code: "MI", label: "Minority (MI)" },
];

const HOME_UNIVERSITIES = [
  { code: "SPPU", label: "SPPU — Pune, Nashik, Ahilyanagar" },
  { code: "MU", label: "Mumbai Univ — Mumbai, Thane, Navi Mumbai, Konkan" },
  { code: "RTMNU", label: "RTMNU — Nagpur, Wardha, Chandrapur" },
  { code: "SUK", label: "Shivaji Univ — Kolhapur, Sangli, Satara" },
  { code: "BAMU", label: "BAMU — Chh. Sambhajinagar, Jalna, Beed" },
  { code: "NMU", label: "KBCNMU — Jalgaon, Dhule, Nandurbar" },
  { code: "SGBAU", label: "SGBAU — Amravati, Akola, Buldhana, Yavatmal" },
  { code: "SRTMU", label: "SRTMU — Nanded, Latur, Parbhani" },
  { code: "SOLU", label: "Punyashlok Ahilyadevi Holkar — Solapur" },
  { code: "ALL", label: "Outside Maharashtra / All-State Only" },
];

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

export default function QuotaOptimizerPage() {
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("95.50");
  const [rank, setRank] = useState("15000");
  const [baseCategory, setBaseCategory] = useState("GOBCS");
  const [gender, setGender] = useState<"female" | "male">("female");
  const [homeUniversity, setHomeUniversity] = useState("SPPU");
  const [incomeBelow8L, setIncomeBelow8L] = useState(true);
  const [isMinority, setIsMinority] = useState(false);
  const [branches, setBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
    "Computer Science and Engineering",
  ]);
  const [cities, setCities] = useState<string[]>(["Pune", "Mumbai", "Navi Mumbai"]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"all" | "unlocked" | "tfws" | "hl">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  const proActive = isProActive(planSession);

  const runOptimizer = async (tokenOverride?: string) => {
    setError("");
    const payload: Record<string, unknown> = {
      base_category: baseCategory,
      gender,
      home_university: homeUniversity,
      income_below_8l: incomeBelow8L,
      is_minority: isMinority,
      branches: branches.length ? branches : null,
      cities: cities.length ? cities : null,
    };

    if (inputType === "percentile") {
      const v = parseFloat(percentile);
      if (isNaN(v) || v <= 0 || v > 100) {
        setError("Enter a valid percentile between 0 and 100.");
        return;
      }
      payload.percentile = v;
    } else {
      const v = parseFloat(rank);
      if (isNaN(v) || v < 1) {
        setError("Enter a valid State Merit Rank.");
        return;
      }
      payload.rank = v;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const tok = tokenOverride ?? getStoredPlan().entitlementToken;
      if (tok) headers["X-Entitlement-Token"] = tok;
      const res = await axios.post(`${API_BASE}/quota-optimizer`, payload, {
        headers,
      });
      setData(res.data);
    } catch (err: any) {
      setError(
        err?.response?.status === 429
          ? "Too many requests. Please wait a minute before scanning again."
          : err?.response?.data?.detail || "Could not scan multi-quota seat pools."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncPlan = () => setPlanSession(getStoredPlan());
    const syncBm = () => setBookmarks(getStoredBookmarks());
    syncPlan();
    syncBm();
    window.addEventListener("cap_plan_updated", syncPlan);
    window.addEventListener("cap_bookmarks_updated", syncBm);
    return () => {
      window.removeEventListener("cap_plan_updated", syncPlan);
      window.removeEventListener("cap_bookmarks_updated", syncBm);
    };
  }, []);

  useEffect(() => {
    if (data && proActive && !data.is_pro) {
      runOptimizer(planSession.entitlementToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proActive]);

  const toggle = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const copyChoiceCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(`Copied Choice Code ${code}`, "success");
    setTimeout(() => setCopiedCode(null), 1500);
  };

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
          historical_percentile: row.unlocked_percentile,
          historical_rank: row.unlocked_rank,
          prediction_category: row.pool_label,
        },
      ]);
    }
  };

  const filteredResults = useMemo(() => {
    const list: any[] = data?.results || [];
    if (activeTab === "unlocked") {
      return list.filter((x) => x.is_newly_unlocked);
    }
    if (activeTab === "tfws") {
      return list.filter((x) => x.pool_family === "tfws");
    }
    if (activeTab === "hl") {
      return list.filter(
        (x) => x.pool_family === "home_univ" || x.pool_family === "ladies"
      );
    }
    return list;
  }, [data, activeTab]);

  const exportCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export all Multi-Quota & TFWS Choice Codes to CSV with CAP Pro Pass"
      );
      return;
    }
    if (!filteredResults.length) return;
    const headers = [
      "DTE_Code",
      "Official_Choice_Code",
      "College_Name",
      "City",
      "Branch",
      "Unlocked_Pool",
      "Unlocked_Category_Code",
      "Unlocked_Cutoff_Pct",
      "State_Cutoff_Pct",
      "Cutoff_Advantage_Pct",
      "Four_Year_Fee_Saved_INR",
      "Official_Website",
    ];
    const rows = filteredResults.map((r) =>
      [
        r.college_code,
        r.choice_code || "",
        r.college_name,
        r.city,
        r.branch,
        r.pool_label,
        r.unlocked_category,
        r.unlocked_percentile,
        r.baseline_percentile ?? "",
        r.cutoff_gain_pct,
        r.four_year_fee_saved_inr ?? "",
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
    a.download = `CAP_Quota_Unlocker_${baseCategory}_${homeUniversity}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    const auth = getStoredAuth();
    const reqHeaders: Record<string, string> = {};
    if (auth?.token) reqHeaders.Authorization = `Bearer ${auth.token}`;
    axios
      .post(
        `${API_BASE}/audit/export`,
        {
          export_type: "quota_optimizer",
          format: "csv",
          record_count: filteredResults.length,
        },
        { headers: reqHeaders }
      )
      .catch(() => undefined);
  };

  const bookmarkedKeys = useMemo(
    () => new Set(bookmarks.map((b) => b.key)),
    [bookmarks]
  );

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
              Multi-Quota &amp; TFWS Seat Unlocker
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Scan Home University (70%), Ladies (30%), TFWS zero-tuition, EWS, and Minority pools at once.
            </p>
          </div>
          {!proActive && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal(
                  "pro",
                  "Unlock all hidden Home-Univ, Ladies 30% & TFWS Zero-Tuition Choice Codes"
                )
              }
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Crown size={15} /> Unlock All Quota Seats • ₹199
            </button>
          )}
        </div>

        {/* Config Card */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Score */}
            <div className="md:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  MHT-CET Score
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-[#E2E8F0] text-[11px] font-bold">
                  {(["percentile", "rank"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInputType(t)}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        inputType === t
                          ? "bg-white text-[#172554] shadow-2xs"
                          : "text-[#64748B]"
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
                className="w-full px-4 py-3 text-lg font-mono tabular-nums font-bold text-[#172554] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/15"
              />
            </div>

            {/* Base Category */}
            <div className="md:col-span-4 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Base Caste / Category
              </label>
              <select
                value={baseCategory}
                onChange={(e) => setBaseCategory(e.target.value)}
                className="w-full px-3.5 py-3.5 text-sm font-semibold text-[#1E293B] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5]"
              >
                {BASE_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Home University */}
            <div className="md:col-span-5 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                12th HSC Home University (70% Quota)
              </label>
              <select
                value={homeUniversity}
                onChange={(e) => setHomeUniversity(e.target.value)}
                className="w-full px-3.5 py-3.5 text-sm font-semibold text-[#1E293B] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5]"
              >
                {HOME_UNIVERSITIES.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Eligibility Toggles Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Gender (30% Ladies Pool)
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-[#E2E8F0]">
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-2 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      gender === g
                        ? "bg-white text-[#172554] shadow-2xs"
                        : "text-[#64748B]"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Family Income (TFWS &amp; EWS)
              </span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(true)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    incomeBelow8L
                      ? "bg-[#4F46E5] text-white shadow-2xs"
                      : "text-[#64748B]"
                  }`}
                >
                  &lt; ₹8 Lakh / yr
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(false)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !incomeBelow8L
                      ? "bg-white text-[#172554] shadow-2xs"
                      : "text-[#64748B]"
                  }`}
                >
                  &ge; ₹8 Lakh / yr
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Linguistic / Religious Minority
              </span>
              <button
                type="button"
                onClick={() => setIsMinority((prev) => !prev)}
                className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  isMinority
                    ? "bg-[#EEF2FF] border-[#4F46E5] text-[#172554]"
                    : "bg-white border-[#E2E8F0] text-[#64748B]"
                }`}
              >
                <span>51% Minority Quota (MI)</span>
                <span className="font-mono text-[11px]">
                  {isMinority ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </div>

          {/* Branches & Cities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <BookOpen size={12} className="text-[#4F46E5]" /> Branches{" "}
                <span className="normal-case font-medium">
                  ({branches.length ? `${branches.length} selected` : "all"})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BRANCH_OPTIONS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggle(branches, setBranches, b)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      branches.includes(b)
                        ? "bg-[#EEF2FF] border-[#4F46E5]/40 text-[#4F46E5]"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-slate-300"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <MapPin size={12} className="text-[#4F46E5]" /> Cities{" "}
                <span className="normal-case font-medium">
                  ({cities.length ? `${cities.length} selected` : "all Maharashtra"})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(cities, setCities, c)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      cities.includes(c)
                        ? "bg-[#172554] border-[#172554] text-white"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-slate-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              disabled={loading}
              onClick={() => runOptimizer()}
              className="px-7 py-3.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-slate-300 text-white font-bold text-sm inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Layers size={16} />
              )}
              {loading ? "Scanning All Eligible Pools..." : "Scan Hidden Quota Seats"}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        {!data && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
            <Layers size={28} className="mx-auto text-[#4F46E5]" />
            <div className="text-sm font-bold text-[#172554]">
              Uncover Lower Cutoffs &amp; Zero-Tuition TFWS Choice Codes
            </div>
            <p className="text-xs text-[#64748B] max-w-lg mx-auto">
              Select your HSC Home University, gender, and income above to see every college unlocked beyond standard State-Level cutoffs.
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#172554] text-white rounded-2xl p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#C7D2FE]">
                  Quota Advantages Found
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums mt-1">
                  {data.summary.total_opportunities}
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  vs {data.student.base_category} State cutoff
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Newly Unlocked Colleges
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-[#172554] mt-1">
                  {data.summary.newly_unlocked_colleges}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">
                  Missed in State pool, cleared here
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                  TFWS Zero-Tuition Seats
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-[#172554] mt-1">
                  {data.summary.tfws_zero_tuition_seats}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">
                  100% Tuition Fee Waiver codes
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Max Quota Advantage
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-[#172554] mt-1">
                  {data.summary.max_verified_4yr_savings_inr > 0
                    ? `₹${(data.summary.max_verified_4yr_savings_inr / 100000).toFixed(2)}L Saved`
                    : `-${Number(data.summary.max_cutoff_advantage_pct || 0).toFixed(2)} %ile`}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">
                  Up to {Number(data.summary.max_cutoff_advantage_pct || 0).toFixed(2)}% easier cutoff
                </div>
              </div>
            </div>

            {/* Filter Bar + CSV Export */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All Advantages" },
                  { id: "unlocked", label: "Newly Unlocked" },
                  { id: "tfws", label: "TFWS Zero-Tuition" },
                  { id: "hl", label: "Home Univ & Ladies" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === t.id
                        ? "bg-[#172554] text-white"
                        : "bg-[#F8FAFC] text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={exportCSV}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
              >
                {!proActive && <Lock size={12} className="text-[#4F46E5]" />}
                <FileSpreadsheet size={14} className="text-emerald-600" /> Export Choice Codes CSV
              </button>
            </div>

            {/* Results List */}
            <div className="space-y-3.5">
              {filteredResults.map((r, idx) => {
                const isSaved = bookmarkedKeys.has(`${r.college_code}|${r.branch}`);
                return (
                  <div
                    key={`${r.college_code}-${r.branch}-${r.unlocked_category}-${idx}`}
                    className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#4F46E5]/40 p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 transition-all"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20">
                          {r.pool_label} ({r.unlocked_category})
                        </span>
                        {r.is_newly_unlocked && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> Newly Unlocked
                          </span>
                        )}
                        {r.four_year_fee_saved_inr != null && r.four_year_fee_saved_inr > 0 && (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Saves ₹{(r.four_year_fee_saved_inr / 100000).toFixed(2)}L (4-Yr)
                          </span>
                        )}
                        <span className="text-xs font-mono text-[#64748B]">
                          DTE: {r.college_code} • {r.city}
                        </span>
                      </div>

                      <Link
                        href={`/college/${r.college_code}`}
                        className="text-base sm:text-lg font-bold text-[#172554] hover:text-[#4F46E5] block leading-snug"
                      >
                        {r.college_name}
                      </Link>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-semibold text-[#4F46E5]">{r.branch}</span>
                        {r.choice_code && (
                          <button
                            type="button"
                            onClick={() => copyChoiceCode(r.choice_code)}
                            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold bg-[#F8FAFC] hover:bg-[#EEF2FF] text-[#172554] px-2.5 py-1 rounded-md border border-[#E2E8F0] cursor-pointer"
                          >
                            Code: {r.choice_code}
                            {copiedCode === r.choice_code ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} className="text-[#64748B]" />
                            )}
                          </button>
                        )}
                        {(r.official_website || r.cet_portal_url) && (
                          <a
                            href={r.official_website || r.cet_portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#64748B] hover:text-[#4F46E5]"
                          >
                            <Globe size={11} />
                            {r.website_domain || "Official Site"}
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E2E8F0]">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[10px] font-bold uppercase text-[#64748B]">
                            {r.unlocked_category} Cutoff
                          </div>
                          <div className="text-base font-extrabold font-mono text-[#172554]">
                            {Number(r.unlocked_percentile).toFixed(2)}%
                          </div>
                          <div className="text-[11px] font-mono text-[#4F46E5] font-semibold">
                            #{Number(r.unlocked_rank).toLocaleString()}
                          </div>
                        </div>

                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-right">
                          <div className="text-[10px] font-bold uppercase text-[#64748B]">
                            vs {r.baseline_category}
                          </div>
                          <div className="text-base font-extrabold font-mono text-emerald-700">
                            {r.cutoff_gain_pct > 0
                              ? `-${Number(r.cutoff_gain_pct).toFixed(2)}%`
                              : r.pool_family === "tfws"
                              ? "₹0 Tuition"
                              : "Direct"}
                          </div>
                          <div className="text-[11px] font-mono text-[#64748B]">
                            {r.baseline_percentile != null
                              ? `State: ${Number(r.baseline_percentile).toFixed(2)}%`
                              : "Special Pool"}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleBookmark(r)}
                        className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          isSaved
                            ? "bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/30"
                            : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:text-[#172554]"
                        }`}
                        title="Save to Shortlist"
                      >
                        <Bookmark
                          size={16}
                          className={isSaved ? "fill-[#4F46E5]" : ""}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Locked Teaser Cards + Pro Unlock Banner */}
              {!proActive && data.summary.locked_count > 0 && (
                <div className="space-y-3 pt-2">
                  {(data.locked_teasers || []).map((t: any, idx: number) => (
                    <div
                      key={`locked-quota-${idx}`}
                      onClick={() =>
                        openUpgradeModal(
                          "pro",
                          `Unlock all ${data.summary.total_opportunities} Multi-Quota & TFWS Choice Codes`
                        )
                      }
                      className="bg-white/80 rounded-2xl border border-[#E2E8F0] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-[#4F46E5]/50 transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                            <Lock size={11} /> {t.pool_label} ({t.unlocked_category})
                          </span>
                          <span className="text-xs font-semibold text-[#172554]">
                            {t.city} • {t.branch}
                          </span>
                          {t.four_year_fee_saved_inr > 0 && (
                            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              Saves ₹{(t.four_year_fee_saved_inr / 100000).toFixed(2)}L
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-400 select-none blur-[4px]">
                          Locked Maharashtra Engineering Institute • Choice Code 627124511T
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono font-bold text-[#172554] bg-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
                          {Number(t.unlocked_percentile).toFixed(2)}% Cutoff
                        </span>
                        <span className="text-xs font-bold text-[#4F46E5] inline-flex items-center gap-1">
                          Unlock <Sparkles size={13} />
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="bg-[#172554] text-white rounded-3xl p-7 sm:p-8 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#C7D2FE] text-xs font-bold">
                      <Lock size={13} /> +{data.summary.locked_count} More Quota &amp; TFWS Seats Locked
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold">
                      Unlock All {data.summary.total_opportunities} Hidden Quota &amp; Zero-Tuition Seats
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                      Reveal every official Home-University, 30% Ladies, EWS, and TFWS 100%-waiver Choice Code for{" "}
                      <strong className="text-white font-mono">₹199</strong> one-time (GPay{" "}
                      <strong className="text-white font-mono">{GPAY_NUMBER}</strong>).
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        openUpgradeModal(
                          "pro",
                          `Unlock all ${data.summary.total_opportunities} Multi-Quota & TFWS Choice Codes`
                        )
                      }
                      className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-sm px-7 py-3.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Crown size={16} /> Unlock CAP Pro Pass — ₹199
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
