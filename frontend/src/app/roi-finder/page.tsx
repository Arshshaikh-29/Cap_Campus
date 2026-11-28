"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  IndianRupee,
  TrendingUp,
  Award,
  Sparkles,
  Lock,
  Crown,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Globe,
  ExternalLink,
  BookOpen,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCategory } from "@/lib/categories";
import {
  GPAY_NUMBER,
  PlanSession,
  escapeCSVCell,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const BRANCH_OPTIONS = [
  "Computer Engineering",
  "Information Technology",
  "Computer Science and Engineering",
  "Artificial Intelligence and Data Science",
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

export default function ROIBudgetFinderPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("96.50");
  const [rank, setRank] = useState("12000");
  const [category, setCategory] = useState("GOBCS");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [incomeBelow8L, setIncomeBelow8L] = useState<boolean>(true);
  const [maxBudgetInr, setMaxBudgetInr] = useState<number>(250000);
  const [useBudgetCap, setUseBudgetCap] = useState<boolean>(false);
  const [branches, setBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
  ]);
  const [cities, setCities] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });

  const proActive = isProActive(planSession);

  const runFinder = async (tokenOverride?: string) => {
    setError("");
    const payload: Record<string, unknown> = {
      category,
      gender,
      income_below_8l: incomeBelow8L,
      max_annual_budget_inr: proActive && useBudgetCap ? maxBudgetInr : null,
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
      const res = await axios.post(`${API_BASE}/roi-finder`, payload, { headers });
      setData(res.data);
    } catch (err: any) {
      setError(
        err?.response?.status === 429
          ? "Too many requests. Please wait a minute."
          : err?.response?.data?.detail || "Could not calculate net fees & ROI."
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

    const syncPlan = () => setPlanSession(getStoredPlan());
    syncPlan();
    window.addEventListener("cap_plan_updated", syncPlan);
    return () => window.removeEventListener("cap_plan_updated", syncPlan);
  }, []);

  useEffect(() => {
    if (data && proActive && !data.is_pro) {
      runFinder(planSession.entitlementToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proActive]);

  const toggle = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const chartData = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const r of data?.results || []) {
      if (seen.has(r.college_code)) continue;
      seen.add(r.college_code);
      out.push({
        name:
          r.college_name.length > 22
            ? `${r.college_name.slice(0, 20)}…`
            : r.college_name,
        "4-Yr Net Fee (₹L)": Number((r.four_year_net_fee_inr / 100000).toFixed(2)),
        "NIRF Median (₹L/yr)": Number(r.nirf_median_lpa),
      });
      if (out.length >= 8) break;
    }
    return out;
  }, [data]);

  const exportCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export your Parent-Ready Scholarship, Net-Fee & ROI Sheet (CSV) with CAP Pro Pass"
      );
      return;
    }
    const list: any[] = data?.results || [];
    if (!list.length) return;
    const headers = [
      "College_Code",
      "College_Name",
      "City",
      "Branch",
      "Band",
      "Cutoff_Percentile",
      "Sticker_Annual_Fee_INR",
      "Net_Annual_Fee_INR",
      "Four_Year_Net_Fee_INR",
      "Four_Year_Scholarship_Savings_INR",
      "Scheme_Applied",
      "NIRF_Median_LPA",
      "Highest_LPA",
      "ROI_Payback_Years",
      "Fee_Source",
      "Official_Website",
    ];
    const rows = list.map((r) =>
      [
        r.college_code,
        r.college_name,
        r.city,
        r.branch,
        r.prediction_category,
        r.cutoff_percentile,
        r.sticker_annual_fee_inr,
        r.net_annual_fee_inr,
        r.four_year_net_fee_inr,
        r.four_year_savings_inr,
        r.scheme_applied,
        r.nirf_median_lpa,
        r.highest_lpa,
        r.net_roi_payback_years,
        r.fee_source,
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
    a.download = `CAP_Scholarship_ROI_Report_${category}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
              Scholarship &amp; ROI Finder
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Net B.Tech fees after MahaDBT/TFWS waivers vs. NIRF median salary.
            </p>
          </div>
          {!proActive && (
            <button
              type="button"
              onClick={() =>
                openUpgradeModal(
                  "pro",
                  "Unlock unlimited ROI rankings, custom Max-Budget filter & Parent-Ready PDF/CSV Budget Reports"
                )
              }
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer shrink-0 print:hidden"
            >
              <Crown size={15} /> Unlock Full ROI Finder • ₹199
            </button>
          )}
        </div>

        {/* Config Card */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Score */}
            <div className="md:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  MHT-CET Score
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
                className="w-full px-4 py-3 text-lg font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
              />
            </div>

            {/* Category */}
            <div className="md:col-span-4 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reservation Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-3.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
              >
                {(categories.length ? categories : ["GOPENS", "GOBCS", "EWS", "TFWS", "GSCS"]).map(
                  (c) => (
                    <option key={c} value={c}>
                      {formatCategory(c)}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Gender */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Candidate Gender
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(["female", "male"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-2.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      gender === g
                        ? "bg-white text-[#172554] shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Family Income */}
            <div className="md:col-span-3 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Annual Family Income
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(true)}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    incomeBelow8L
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  &lt; ₹8 Lakh
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(false)}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !incomeBelow8L
                      ? "bg-white text-[#172554] shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  &ge; ₹8 Lakh
                </button>
              </div>
            </div>
          </div>

          {/* Pro Custom Budget Cap */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                id="budget-cap"
                type="checkbox"
                checked={proActive && useBudgetCap}
                onChange={(e) => {
                  if (!proActive) {
                    openUpgradeModal(
                      "pro",
                      "Filter reachable colleges by custom Max Annual Net Budget with CAP Pro Pass"
                    );
                    return;
                  }
                  setUseBudgetCap(e.target.checked);
                }}
                className="w-4 h-4 accent-electric-blue cursor-pointer"
              />
              <label htmlFor="budget-cap" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                Filter by Max Annual Net Budget
                {!proActive && (
                  <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <Lock size={10} /> PRO
                  </span>
                )}
              </label>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-80">
              <input
                type="range"
                min={20000}
                max={250000}
                step={10000}
                disabled={!proActive || !useBudgetCap}
                value={maxBudgetInr}
                onChange={(e) => setMaxBudgetInr(Number(e.target.value))}
                className="flex-1 accent-electric-blue disabled:opacity-40"
              />
              <span className="font-mono text-xs font-extrabold text-[#172554] w-24 text-right">
                ₹{(maxBudgetInr / 100000).toFixed(2)}L / yr
              </span>
            </div>
          </div>

          {/* Branches & Cities */}
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

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => runFinder()}
              className="px-7 py-3.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-slate-300 text-white font-bold text-sm inline-flex items-center gap-2 shadow-md cursor-pointer"
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {loading ? "Calculating Net Fees & ROI..." : "Calculate Net Fees & Best ROI"}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        {data && (
          <>
            {/* Active Scholarship Eligibility Callout */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Maharashtra Scholarship Scheme Applied
                  </div>
                  <div className="text-base font-extrabold text-[#172554]">
                    {data.scheme_applied}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <a
                  href={data.sources?.mahadbt_portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 inline-flex items-center gap-1"
                >
                  MahaDBT Portal <ExternalLink size={11} />
                </a>
                <a
                  href={data.sources?.fra_portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 inline-flex items-center gap-1"
                >
                  Maharashtra FRA <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Verified ROI Matches
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-[#172554] mt-1.5">
                  {data.summary.total_matches}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Reachable courses with NIRF &amp; FRA data
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <TrendingUp size={13} /> Best Net ROI Payback
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 mt-1.5">
                  {data.summary.best_payback_years != null
                    ? `${data.summary.best_payback_years} yrs`
                    : "N/A"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  4-Yr Net Fee ÷ NIRF Median Package
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                  <IndianRupee size={13} /> Max 4-Yr Scholarship Savings
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-indigo-600 mt-1.5">
                  ₹{(Number(data.summary.max_four_year_savings_inr || 0) / 100000).toFixed(2)}L
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Saved over 4 years vs. full Open fee
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-electric-blue flex items-center gap-1">
                  <Award size={13} /> Top NIRF Median Reachable
                </div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-electric-blue mt-1.5">
                  {data.summary.highest_nirf_median_lpa != null
                    ? `₹${Number(data.summary.highest_nirf_median_lpa).toFixed(1)} LPA`
                    : "N/A"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Official Ministry of Education NIRF data
                </div>
              </div>
            </div>

            {/* Visual ROI Chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#172554]">
                      4-Year Net Fee vs. First-Year NIRF Median Package (₹ Lakhs)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Lower indigo bar + taller emerald bar = superior financial ROI!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={exportCSV}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {!proActive && <Lock size={12} className="text-amber-600" />}
                      <FileSpreadsheet size={14} className="text-emerald-600" /> Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!proActive) {
                          openUpgradeModal(
                            "pro",
                            "Print a clean Parent-Ready Scholarship & ROI Budget PDF with CAP Pro Pass"
                          );
                          return;
                        }
                        window.print();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {!proActive && <Lock size={12} className="text-amber-400" />}
                      <Printer size={14} /> Print Budget PDF
                    </button>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="4-Yr Net Fee (₹L)" fill="#6366F1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="NIRF Median (₹L/yr)" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ROI Ranked Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[820px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">ROI Rank &amp; College</th>
                      <th className="py-3 px-4">Branch &amp; Cutoff</th>
                      <th className="py-3 px-4 text-right">Sticker vs. Net Fee/yr</th>
                      <th className="py-3 px-4 text-right">4-Yr Net &amp; Savings</th>
                      <th className="py-3 px-4 text-right">NIRF Median</th>
                      <th className="py-3 px-4 text-right">Net ROI Payback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(data.results || []).map((r: any, idx: number) => (
                      <tr key={`${r.college_code}-${r.branch}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded bg-[#172554] text-white shrink-0">
                              #{idx + 1}
                            </span>
                            <div>
                              <Link
                                href={`/college/${r.college_code}`}
                                className="font-bold text-[#172554] hover:text-electric-blue leading-snug block"
                              >
                                {r.college_name}
                              </Link>
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span>{r.city}</span>
                                <span>•</span>
                                <span>{r.fee_source}</span>
                                {(r.official_website || r.cet_portal_url) && (
                                  <>
                                    <span>•</span>
                                    <a
                                      href={r.official_website || r.cet_portal_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 font-mono text-electric-blue hover:underline"
                                    >
                                      <Globe size={10} /> {r.website_domain || "CET"}
                                      <ExternalLink size={9} />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-electric-blue">{r.branch}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {Number(r.cutoff_percentile).toFixed(2)}% • {r.prediction_category}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {r.annual_savings_inr > 0 && (
                            <div className="text-[11px] text-slate-400 line-through">
                              ₹{Number(r.sticker_annual_fee_inr).toLocaleString()}
                            </div>
                          )}
                          <div className="font-extrabold text-[#172554]">
                            ₹{Number(r.net_annual_fee_inr).toLocaleString()}/yr
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <div className="font-bold text-indigo-700">
                            ₹{(r.four_year_net_fee_inr / 100000).toFixed(2)}L total
                          </div>
                          {r.four_year_savings_inr > 0 && (
                            <div className="text-[11px] font-bold text-emerald-600">
                              Save ₹{(r.four_year_savings_inr / 100000).toFixed(2)}L
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          <div className="font-extrabold text-emerald-700">
                            ₹{Number(r.nirf_median_lpa).toFixed(2)} LPA
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Max ₹{Number(r.highest_lpa).toFixed(0)}L
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {r.net_roi_payback_years} yr
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!data.is_pro && data.summary.locked_count > 0 && (
                <div className="p-6 bg-gradient-to-r from-[#172554] via-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <Lock size={13} /> {data.summary.locked_count} More ROI-Ranked
                      Colleges Unlocked in CAP Pro
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Unlock the complete Net-Fee &amp; Scholarship ROI ranking,
                      custom Max-Budget slider, Betterment Radar, and Parent-Ready
                      PDF/CSV exports for ₹199 one-time via GPay ({GPAY_NUMBER}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal(
                        "pro",
                        `Unlock all ${data.summary.locked_count} remaining ROI-ranked colleges + Max-Budget filter`
                      )
                    }
                    className="px-5 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer"
                  >
                    <Crown size={14} /> Unlock CAP Pro • ₹199
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
              <ShieldCheck size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Fee estimates use verified <strong>Maharashtra FRA</strong> /{" "}
                <strong>Govt. Institute Circulars</strong> and official{" "}
                <strong>MahaDBT</strong> scholarship rules (tuition ~87% of annual
                fee). Salary data comes from official <strong>NIRF</strong>{" "}
                engineering disclosures. Always confirm final payable fees on the
                college admission portal.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
