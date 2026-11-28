"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeftRight,
  Percent,
  Hash,
  Calculator,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ListOrdered,
  Award,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function RankCalculatorPage() {
  const [mode, setMode] = useState<"percentile" | "marks" | "rank">("percentile");
  const [percentile, setPercentile] = useState("96.50");
  const [marks, setMarks] = useState("125");
  const [rank, setRank] = useState("12000");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, any> = {};
      if (mode === "percentile") {
        const v = parseFloat(percentile);
        if (isNaN(v) || v <= 0 || v > 100) return;
        params.percentile = v;
      } else if (mode === "marks") {
        const v = parseFloat(marks);
        if (isNaN(v) || v < 0 || v > 200) return;
        params.marks = v;
      } else {
        const v = parseFloat(rank);
        if (isNaN(v) || v < 1) return;
        params.rank = v;
      }
      setLoading(true);
      axios
        .get(`${API_BASE}/rank-curve`, { params })
        .then((res) => setData(res.data))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 150);

    return () => clearTimeout(timer);
  }, [mode, percentile, marks, rank]);

  const est = data?.estimate;
  const estPct = est?.estimated_percentile ?? 0;
  const estRank = est?.estimated_rank ?? 0;

  const tierAssessment =
    estPct >= 99.0
      ? {
          label: "Elite Tier-1 Autonomous Range",
          colleges: "VJTI Mumbai, COEP Pune, SPIT Mumbai, PICT Pune, Walchand Sangli",
          color: "bg-emerald-50 border-emerald-200 text-emerald-900",
        }
      : estPct >= 95.0
      ? {
          label: "Premier Pune / Mumbai Institutes",
          colleges: "DJ Sanghvi, VIT Pune, PCCOE Pune, Cummins (Ladies), Thadomal, KJSCE",
          color: "bg-[#EEF2FF] border-[#4F46E5]/20 text-blue-900",
        }
      : estPct >= 88.0
      ? {
          label: "Strong Autonomous & State Institutes",
          colleges: "MIT-WPU / AISSMS, RCOEM Nagpur, VESIT, Fr. CRCE, PVG Pune, Government Colleges",
          color: "bg-indigo-50 border-indigo-200 text-indigo-900",
        }
      : {
          label: "Wide State & Category Seat Pool",
          colleges: "Regional Government & Private Institutes across Pune, Mumbai, Nagpur, Nashik & Kolhapur",
          color: "bg-slate-100 border-slate-200 text-slate-800",
        };

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
              Rank Calculator
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Convert MHT-CET marks or percentile to 2023–2026 State Merit Rank.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/?start=1"
              className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles size={14} /> Predict Colleges
            </Link>
            <Link
              href="/option-form"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#172554] text-xs font-bold flex items-center gap-1.5"
            >
              <ListOrdered size={14} className="text-electric-blue" /> Build
              Option Form
            </Link>
          </div>
        </div>

        {/* Interactive Calculator Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-7 space-y-6">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Select Input Mode
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-[#E2E8F0]">
                {[
                  { id: "percentile", label: "Percentile", icon: Percent },
                  { id: "marks", label: "Marks / 200", icon: Calculator },
                  { id: "rank", label: "Merit Rank", icon: Hash },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id as any)}
                      className={`py-2.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? "bg-white text-[#172554] shadow-xs ring-1 ring-slate-900/5"
                          : "text-slate-600 hover:text-[#172554]"
                      }`}
                    >
                      <Icon
                        size={13}
                        className={active ? "text-electric-blue" : "text-slate-400"}
                      />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "percentile" && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  MHT-CET Percentile (0 – 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="100"
                    value={percentile}
                    onChange={(e) => setPercentile(e.target.value)}
                    className="w-full text-2xl font-mono tabular-nums font-bold text-[#172554] pl-4 pr-20 py-3.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                    %ile
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["99.5", "98.0", "95.0", "90.0", "85.0", "75.0"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPercentile(v)}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer"
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "marks" && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Estimated MHT-CET PCM Marks (Out of 200)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    className="w-full text-2xl font-mono tabular-nums font-bold text-[#172554] pl-4 pr-24 py-3.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                    / 200
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["165", "145", "125", "105", "85", "65"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMarks(v)}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer"
                    >
                      {v} marks
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "rank" && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  State Merit Rank (2025 CAP Scale)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="w-full text-2xl font-mono tabular-nums font-bold text-[#172554] pl-4 pr-24 py-3.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-slate-200 text-slate-600 font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                    Rank #
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["1500", "5000", "12000", "25000", "50000"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRank(v)}
                      className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer"
                    >
                      #{Number(v).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tier Readiness Assessment */}
            {est && (
              <div className={`p-4 rounded-2xl border space-y-1.5 ${tierAssessment.color}`}>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Award size={15} /> {tierAssessment.label}
                </div>
                <p className="text-xs opacity-90 leading-relaxed">
                  Target Zone: <strong>{tierAssessment.colleges}</strong>
                </p>
              </div>
            )}
          </div>

          {/* Right: Live Result Dashboard */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#172554] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-electric-blue/25 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#C7D2FE]">
                    2025 CAP State Merit Rank
                  </div>
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums mt-1 text-white">
                    {loading || !est
                      ? "..."
                      : `#${Number(estRank).toLocaleString()}`}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Out of ~3.19 lakh Maharashtra PCM merit candidates
                  </div>
                </div>
                <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Equivalent Percentile</span>
                    <span className="font-mono font-bold text-[#C7D2FE] text-base">
                      {est ? `${Number(estPct).toFixed(2)} %ile` : "..."}
                    </span>
                  </div>
                  {est?.percentile_range && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Shift Difficulty Band</span>
                      <span className="font-mono text-slate-200">
                        {est.percentile_range[0]}% – {est.percentile_range[1]}%
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                    {["2023", "2024", "2025"].map((yr) => (
                      <div key={yr} className="bg-white/[0.04] rounded-lg p-2">
                        <div className="text-[10px] text-slate-400 font-bold">
                          CAP {yr}
                        </div>
                        <div className="font-mono text-xs font-bold text-white mt-0.5">
                          {est?.by_year?.[yr] != null
                            ? mode === "rank"
                              ? `${Number(est.by_year[yr]).toFixed(1)}%`
                              : `#${Number(est.by_year[yr]).toLocaleString()}`
                            : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Year Curve Chart */}
            <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#172554] flex items-center gap-2">
                    <TrendingUp size={16} className="text-electric-blue" />{" "}
                    Percentile vs State Merit Rank Curve (2023–2025)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notice how the same percentile corresponds to a higher rank
                    number each year as applicants grew.
                  </p>
                </div>
              </div>
              <div className="h-64 w-full">
                {data?.curve && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[...data.curve].reverse()}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="percentile"
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                        tick={{ fontSize: 11, fill: "#64748B" }}
                      />
                      <Tooltip
                        formatter={(val: any, name: any) => [
                          `#${Number(val).toLocaleString()}`,
                          name === "rank_2025"
                            ? "2025 Rank"
                            : name === "rank_2024"
                            ? "2024 Rank"
                            : "2023 Rank",
                        ]}
                        labelFormatter={(l) => `Percentile: ${l} %ile`}
                      />
                      <Area
                        type="monotone"
                        dataKey="rank_2025"
                        stroke="#4F46E5"
                        fill="#4F46E5"
                        fillOpacity={0.12}
                        strokeWidth={2.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="rank_2024"
                        stroke="#14B8A6"
                        fill="#14B8A6"
                        fillOpacity={0.07}
                        strokeWidth={1.8}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Marks vs Percentile vs Rank Table */}
        {data?.marks_table && (
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#172554]">
                  MHT-CET PCM Marks vs Percentile vs 2025 State Merit Rank Table
                </h2>
                <p className="text-xs text-slate-500">
                  Quick benchmark chart for moderate difficulty shifts (actual
                  normalization varies slightly by shift).
                </p>
              </div>
              <Link
                href="/option-form"
                className="text-xs font-bold text-electric-blue hover:underline flex items-center gap-1"
              >
                Build My CAP Option Form <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {data.marks_table.map((row: any) => (
                <div
                  key={row.marks}
                  className="p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] text-center space-y-1"
                >
                  <div className="text-[11px] font-bold text-slate-500">
                    {row.marks} / 200
                  </div>
                  <div className="text-base font-extrabold font-mono tabular-nums text-[#172554]">
                    {Number(row.percentile).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-electric-blue">
                    #{Number(row.rank_2025).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
