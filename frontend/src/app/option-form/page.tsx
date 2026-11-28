"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Sparkles,
  FileSpreadsheet,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Crown,
  CheckCircle2,
  RefreshCw,
  ListOrdered,
  Copy,
  Check,
  MapPin,
  BookOpen,
  Globe,
  ExternalLink,
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
import { getStoredAuth } from "@/lib/auth";

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
  "Nagpur",
  "Nashik",
  "Chhatrapati Sambhajinagar",
  "Kolhapur",
  "Sangli",
  "Thane",
];

const FREE_PREVIEW_LIMIT = 10;

export default function OptionFormBuilderPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("96.50");
  const [rank, setRank] = useState("12000");
  const [category, setCategory] = useState("GOPENS");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
    "Computer Science and Engineering",
  ]);
  const [selectedCities, setSelectedCities] = useState<string[]>([
    "Pune",
    "Mumbai",
  ]);
  const [strategy, setStrategy] = useState<"balanced" | "dream_heavy" | "safe_first">("balanced");
  const [maxChoices, setMaxChoices] = useState<number>(30);

  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<any[]>([]);
  const [studentMeta, setStudentMeta] = useState<any>(null);
  const [advice, setAdvice] = useState<string[]>([]);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [serverLockedCount, setServerLockedCount] = useState<number>(0);
  const [serverTotalGenerated, setServerTotalGenerated] = useState<number>(0);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);

    const syncPlan = () => setPlanSession(getStoredPlan());
    syncPlan();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get("p");
      const rParam = params.get("r");
      const catParam = params.get("cat");
      const bParam = params.get("b");
      const cParam = params.get("c");
      if (pParam || rParam) {
        if (rParam && !pParam) {
          setInputType("rank");
          setRank(rParam);
        } else if (pParam) {
          setInputType("percentile");
          setPercentile(pParam);
        }
        if (catParam) setCategory(catParam.toUpperCase());
        if (bParam) {
          setSelectedBranches(
            bParam.split(",").map((s) => s.trim()).filter(Boolean)
          );
        }
        if (cParam) {
          setSelectedCities(
            cParam.split(",").map((s) => s.trim()).filter(Boolean)
          );
        }
      }
    }

    window.addEventListener("cap_plan_updated", syncPlan);
    return () => window.removeEventListener("cap_plan_updated", syncPlan);
  }, []);

  const proActive = isProActive(planSession);

  const toggleItem = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const generateForm = async (overrideToken?: string) => {
    setLoading(true);
    try {
      const payload: any = {
        category,
        branches: selectedBranches.length ? selectedBranches : null,
        cities: selectedCities.length ? selectedCities : null,
        strategy,
        max_choices: maxChoices,
      };
      if (inputType === "percentile") {
        payload.percentile = parseFloat(percentile);
      } else {
        payload.rank = parseFloat(rank);
      }
      const token = overrideToken ?? getStoredPlan().entitlementToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers["X-Entitlement-Token"] = token;
      }
      const res = await axios.post(`${API_BASE}/option-form/generate`, payload, {
        headers,
      });
      setChoices(res.data.choices || []);
      setStudentMeta(res.data.student || null);
      setAdvice(res.data.advice || []);
      setHealthScore(res.data.health_score ?? 90);
      setServerLockedCount(Number(res.data.locked_choices_count || 0));
      setServerTotalGenerated(
        Number(res.data.total_generated || (res.data.choices || []).length)
      );
      setHasGenerated(true);
    } catch (err: any) {
      alert(
        err?.response?.data?.detail ||
        "Could not generate Option Form. Please check your score input."
      );
    } finally {
      setLoading(false);
    }
  };

  // Automatically re-fetch full 30-60 choices from server the instant user unlocks Pro
  useEffect(() => {
    if (hasGenerated && proActive && serverLockedCount > 0 && planSession.entitlementToken) {
      generateForm(planSession.entitlementToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proActive, planSession.entitlementToken]);

  const recordExportAudit = (format: "csv" | "pdf", count: number) => {
    const auth = getStoredAuth();
    const headers: Record<string, string> = {};
    if (auth?.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }
    axios
      .post(
        `${API_BASE}/audit/export`,
        { export_type: "option_form", format, record_count: count },
        { headers }
      )
      .catch(() => undefined);
  };

  // Detect live DTE ordering mistakes when user manually reorders choices
  const liveOrderWarnings = useMemo(() => {
    const warnings: string[] = [];
    let seenSafe = false;
    let misorderedCount = 0;
    for (const c of choices) {
      if (c.tier === "Safe") seenSafe = true;
      if (seenSafe && c.tier === "Dream") misorderedCount += 1;
    }
    if (misorderedCount > 0) {
      warnings.push(
        `Warning: ${misorderedCount} Dream option(s) are placed BELOW a Safe option! In DTE CAP counselling, always keep Dream/Target choices at the top so your Safe seat doesn't block betterment.`
      );
    }
    return warnings;
  }, [choices]);

  const tierCounts = useMemo(() => {
    return {
      dream: choices.filter((c) => c.tier === "Dream").length,
      target: choices.filter((c) => c.tier === "Target").length,
      safe: choices.filter((c) => c.tier === "Safe").length,
    };
  }, [choices]);

  const moveChoice = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= choices.length) return;
    const copy = [...choices];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setChoices(copy.map((c, idx) => ({ ...c, preference_no: idx + 1 })));
  };

  const removeChoice = (index: number) => {
    const copy = choices.filter((_, i) => i !== index);
    setChoices(copy.map((c, idx) => ({ ...c, preference_no: idx + 1 })));
  };

  const autoSortOptimal = () => {
    const sorted = [...choices].sort(
      (a, b) => (a.historical_rank || 1e9) - (b.historical_rank || 1e9)
    );
    setChoices(sorted.map((c, idx) => ({ ...c, preference_no: idx + 1 })));
  };

  const copyChoiceCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const exportOptionFormCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export your complete CET-Ready Option Form CSV with CAP Pro Pass"
      );
      return;
    }
    if (!choices.length) return;
    const headers = [
      "Preference_No",
      "DTE_Choice_Code",
      "Institute_Code",
      "College_Name",
      "City",
      "Branch",
      "Strategy_Tier",
      "Category_Cutoff_Percentile",
      "Category_Cutoff_Rank",
      "Margin_Percentile",
      "Seat_Basis",
      "Official_Website",
    ];
    const rows = choices.map((c, idx) =>
      [
        idx + 1,
        c.choice_code || "",
        c.college_code,
        c.college_name,
        c.city,
        c.branch,
        c.tier,
        c.historical_percentile != null ? c.historical_percentile.toFixed(2) : "",
        c.historical_rank != null ? Math.round(c.historical_rank) : "",
        c.margin_percentile != null ? c.margin_percentile.toFixed(2) : "",
        c.is_estimate ? `Calibrated (${c.basis_category})` : `Direct (${c.basis_category})`,
        c.official_website || c.cet_portal_url || "",
      ]
        .map(escapeCSVCell)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_Option_Form_${category}_${choices.length}_Choices.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordExportAudit("csv", choices.length);
  };

  const visibleChoices = proActive
    ? choices
    : choices.slice(0, FREE_PREVIEW_LIMIT);
  const totalChoicePool = Math.max(serverTotalGenerated, choices.length);
  const lockedCount = proActive
    ? 0
    : Math.max(serverLockedCount, choices.length - visibleChoices.length);

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-bold uppercase tracking-wider">
              <ListOrdered size={13} /> Flagship CAP Counselling Engine
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Smart CAP Option Form Builder
            </h1>
            <p className="text-sm sm:text-base text-slate-500">
              Generate a scientifically ordered <strong>Dream &rarr; Target &rarr; Safe</strong>{" "}
              DTE preference list with official 9-digit Choice Codes so you never
              lose a better seat during CAP Round 1–3 betterment.
            </p>
          </div>
          {!proActive && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal(
                  "pro",
                  "Unlock all 60 Option Form choices + CET-ready CSV & PDF export"
                )
              }
              className="bg-gradient-to-r from-electric-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Crown size={15} /> Unlock Full Option Form (₹199 via GPay)
            </button>
          )}
        </div>

        {/* Builder Config Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Score Mode & Value */}
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Your MHT-CET Score
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setInputType("percentile")}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${inputType === "percentile"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500"
                      }`}
                  >
                    %ile
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputType("rank")}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${inputType === "rank"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500"
                      }`}
                  >
                    Rank
                  </button>
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
                placeholder={inputType === "percentile" ? "96.50" : "12000"}
                className="w-full px-4 py-3 text-lg font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
              />
            </div>

            {/* Category */}
            <div className="md:col-span-5 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reservation Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
              >
                {categories.length ? (
                  categories.map((c) => (
                    <option key={c} value={c}>
                      {formatCategory(c)}
                    </option>
                  ))
                ) : (
                  <option value="GOPENS">{formatCategory("GOPENS")}</option>
                )}
              </select>
            </div>

            {/* Target List Length */}
            <div className="md:col-span-3 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Option Form Size
              </label>
              <select
                value={maxChoices}
                onChange={(e) => setMaxChoices(Number(e.target.value))}
                className="w-full px-4 py-3.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
              >
                <option value={20}>20 Choices</option>
                <option value={30}>30 Choices (Ideal)</option>
                <option value={45}>45 Choices</option>
                <option value={60}>60 Choices (Max)</option>
              </select>
            </div>
          </div>

          {/* Multi-select Branches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen size={13} className="text-electric-blue" /> Target
                Branches (Click to toggle — leave none for All)
              </span>
              {selectedBranches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBranches([])}
                  className="text-[11px] font-semibold text-electric-blue hover:underline cursor-pointer"
                >
                  Clear Branches
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BRANCH_OPTIONS.map((b) => {
                const active = selectedBranches.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() =>
                      toggleItem(selectedBranches, setSelectedBranches, b)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${active
                      ? "bg-electric-blue text-white border-electric-blue shadow-2xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-select Cities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin size={13} className="text-electric-blue" /> Preferred
                Cities (Click to toggle — leave none for All Maharashtra)
              </span>
              {selectedCities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCities([])}
                  className="text-[11px] font-semibold text-electric-blue hover:underline cursor-pointer"
                >
                  Clear Cities
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CITY_OPTIONS.map((c) => {
                const active = selectedCities.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      toggleItem(selectedCities, setSelectedCities, c)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${active
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategy Cards + Generate CTA */}
          <div className="pt-4 border-t border-slate-200/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
              {[
                {
                  id: "balanced",
                  title: "Balanced CAP Mix",
                  desc: "20% Dream • 45% Target • 35% Safe",
                },
                {
                  id: "dream_heavy",
                  title: "Dream Betterment",
                  desc: "35% Dream • 40% Target • 25% Safe",
                },
                {
                  id: "safe_first",
                  title: "High-Safety Net",
                  desc: "10% Dream • 40% Target • 50% Safe",
                },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategy(s.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${strategy === s.id
                    ? "bg-electric-blue/[0.06] border-electric-blue ring-2 ring-electric-blue/15"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                    }`}
                >
                  <div className="text-xs font-bold text-slate-900">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => generateForm()}
              disabled={loading}
              className="bg-electric-blue hover:bg-blue-600 text-white font-bold text-sm px-7 py-4 rounded-xl shadow-lg shadow-electric-blue/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loading ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Sparkles size={17} />
              )}
              {loading ? "Building Preference Sheet..." : "Generate Option Form"}
            </button>
          </div>
        </div>

        {/* Generated Option Form Output */}
        {hasGenerated && (
          <div className="space-y-6">
            {/* Health Score & Summary Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 bg-[#0B1120] text-white rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                    Option Form Health Score
                  </div>
                  <div className="text-4xl font-extrabold font-mono tabular-nums mt-1">
                    {Math.max(
                      30,
                      healthScore - (liveOrderWarnings.length > 0 ? 25 : 0)
                    )}
                    <span className="text-lg text-slate-400">/100</span>
                  </div>
                  {studentMeta && (
                    <div className="text-xs font-mono text-slate-300 mt-2">
                      {Number(studentMeta.percentile).toFixed(2)}%ile &harr; Rank #
                      {Number(studentMeta.rank).toLocaleString()}
                    </div>
                  )}
                </div>
                <ShieldCheck
                  size={44}
                  className={
                    liveOrderWarnings.length > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }
                />
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70">
                    <div className="text-[11px] font-bold text-rose-700 uppercase">
                      Dream Choices
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {tierCounts.dream}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                    <div className="text-[11px] font-bold text-amber-700 uppercase">
                      Target Choices
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {tierCounts.target}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">
                      Safe Backups
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                      {tierCounts.safe}
                    </div>
                  </div>
                </div>

                {/* Live Strategy Warnings */}
                <div className="space-y-1.5">
                  {[...liveOrderWarnings, ...advice].map((msg, i) => {
                    const isWarn =
                      msg.startsWith("Warning:") ||
                      msg.includes("Fewer") ||
                      msg.includes("Short");
                    return (
                      <div
                        key={i}
                        className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${isWarn
                          ? "bg-amber-50 text-amber-900 border border-amber-200"
                          : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          }`}
                      >
                        {isWarn ? (
                          <AlertTriangle size={14} className="shrink-0" />
                        ) : (
                          <CheckCircle2 size={14} className="shrink-0" />
                        )}
                        <span>{msg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table Actions */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Ordered CAP Option Form ({choices.length} Preferences)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Use arrows to customize preference order. Official 9-digit
                    Choice Codes can be copied straight into the CET Cell portal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={autoSortOptimal}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Auto-Fix DTE Order
                  </button>
                  <button
                    type="button"
                    onClick={exportOptionFormCSV}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} className="text-amber-600" />}
                    <FileSpreadsheet size={14} className="text-emerald-600" />{" "}
                    Export CET CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!proActive) {
                        openUpgradeModal(
                          "pro",
                          "Print / Save your full Option Form PDF with CAP Pro Pass"
                        );
                        return;
                      }
                      recordExportAudit("pdf", choices.length);
                      window.print();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} className="text-amber-400" />}
                    <Download size={14} /> Print PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-20">Pref #</th>
                      <th className="py-3 px-4 w-36">Choice Code</th>
                      <th className="py-3 px-4">Institute &amp; Branch</th>
                      <th className="py-3 px-4 w-28">Tier</th>
                      <th className="py-3 px-4 text-right">
                        {category} Cutoff
                      </th>
                      <th className="py-3 px-4 text-right print:hidden">
                        Reorder
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleChoices.map((c, idx) => {
                      const tierStyle =
                        c.tier === "Safe"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : c.tier === "Target"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200";
                      return (
                        <tr
                          key={`${c.college_code}-${c.branch}-${idx}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono tabular-nums font-extrabold text-slate-900 text-sm">
                            #{String(idx + 1).padStart(2, "0")}
                          </td>
                          <td className="py-3.5 px-4">
                            {c.choice_code ? (
                              <button
                                type="button"
                                onClick={() => copyChoiceCode(c.choice_code)}
                                className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px] font-bold bg-slate-100 hover:bg-electric-blue/10 hover:text-electric-blue px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer"
                                title="Click to copy official DTE Choice Code"
                              >
                                {c.choice_code}
                                {copiedCode === c.choice_code ? (
                                  <Check size={11} className="text-emerald-600" />
                                ) : (
                                  <Copy size={11} className="text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="font-mono text-slate-400">
                                {c.college_code}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/college/${c.college_code}`}
                              className="font-bold text-slate-900 hover:text-electric-blue block leading-snug"
                            >
                              {c.college_name}
                            </Link>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="text-electric-blue font-semibold">
                                {c.branch}
                              </span>
                              <span>•</span>
                              <span>{c.city}</span>
                              {(c.official_website || c.cet_portal_url) && (
                                <>
                                  <span className="print:hidden">•</span>
                                  <a
                                    href={c.official_website || c.cet_portal_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-600 hover:text-electric-blue hover:underline print:hidden"
                                  >
                                    <Globe size={10} className="text-electric-blue" />
                                    {c.website_domain || "CET Profile"}
                                    <ExternalLink size={9} />
                                  </a>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierStyle}`}
                            >
                              {c.tier}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <div className="font-bold text-slate-900">
                              {c.historical_percentile != null
                                ? `${Number(c.historical_percentile).toFixed(2)} %`
                                : "N/A"}
                            </div>
                            <div className="text-[11px] text-electric-blue font-semibold">
                              Rank #
                              {Math.round(c.historical_rank || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right print:hidden">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveChoice(idx, -1)}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChoice(idx, 1)}
                                disabled={idx === visibleChoices.length - 1}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeChoice(idx)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                                title="Remove Choice"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pro Unlock Gate when Free */}
              {lockedCount > 0 && (
                <div className="p-8 bg-gradient-to-b from-slate-50 to-blue-50/70 border-t border-slate-200 text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 text-electric-blue text-xs font-bold">
                    <Lock size={13} /> {lockedCount} More Optimized Choices
                    Locked (Including Your Target &amp; Safe Backups)
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    Unlock Your Complete {totalChoicePool}-Choice DTE Option Form
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
                    Get all {totalChoicePool} ordered colleges with official
                    9-digit Choice Codes, unlimited CSV/PDF export, and full
                    season access for just{" "}
                    <strong className="text-slate-900">₹199</strong> via Google
                    Pay (<strong className="font-mono">{GPAY_NUMBER}</strong>).
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal(
                        "pro",
                        `Unlock all ${totalChoicePool} ordered CAP Option Form choices`
                      )
                    }
                    className="bg-electric-blue hover:bg-blue-600 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-electric-blue/25 inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Crown size={16} /> Unlock CAP Pro Pass — ₹199
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
