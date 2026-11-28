"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
  MapPin,
  BookOpen,
  RefreshCw,
  Sparkles,
  Globe,
  ExternalLink,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCategory } from "@/lib/categories";

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
];

interface WhatIfPoint {
  delta: number;
  percentile: number;
  rank: number;
  within_range: number;
  moderate: number;
  ambitious: number;
  changed_count: number;
  changed: {
    college_code: string;
    college_name: string;
    city: string;
    branch: string;
    choice_code?: string;
    official_website?: string | null;
    website_domain?: string | null;
    cet_portal_url?: string | null;
    historical_percentile: number;
    historical_rank: number;
    is_estimate: boolean;
  }[];
}

interface WhatIfResponse {
  category: string;
  base_percentile: number;
  base_rank: number;
  rank_scale_year: number;
  total_courses: number;
  points: WhatIfPoint[];
}

const formatDelta = (d: number) =>
  d === 0 ? "Your score" : `${d > 0 ? "+" : "−"}${Math.abs(d)} %ile`;

export default function WhatIfSimulatorPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("94.50");
  const [rank, setRank] = useState("18000");
  const [category, setCategory] = useState("GOPENS");
  const [branches, setBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
  ]);
  const [cities, setCities] = useState<string[]>(["Pune", "Mumbai"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<WhatIfResponse | null>(null);
  const [selectedDelta, setSelectedDelta] = useState<number>(1);

  const runSimulationWith = async (opts: {
    mode: "percentile" | "rank";
    pct: string;
    rnk: string;
    cat: string;
    br: string[];
    ct: string[];
  }) => {
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
      const res = await axios.post(`${API_BASE}/what-if`, payload);
      setData(res.data);
      setSelectedDelta(1);
    } catch (err: any) {
      setError(
        err?.response?.status === 429
          ? "Too many simulations in a short time. Please wait a minute."
          : err?.response?.data?.detail || "Could not run the simulation. Is the backend running?"
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
        runSimulationWith({ mode, pct, rnk, cat, br, ct });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const runSimulation = () =>
    runSimulationWith({
      mode: inputType,
      pct: percentile,
      rnk: rank,
      cat: category,
      br: branches,
      ct: cities,
    });

  const chartData = useMemo(
    () =>
      (data?.points || []).map((p) => ({
        name: formatDelta(p.delta),
        delta: p.delta,
        "Within Range": p.within_range,
        Moderate: p.moderate,
        Ambitious: p.ambitious,
      })),
    [data]
  );

  const basePoint = data?.points.find((p) => p.delta === 0);
  const selectedPoint = data?.points.find((p) => p.delta === selectedDelta);

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-bold uppercase tracking-wider">
            <Activity size={13} /> New • Score Impact Simulator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#172554]">
            What-If Score Simulator
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            See exactly how many colleges you <strong>unlock</strong> with a
            slightly higher score — and which seats are <strong>at risk</strong>{" "}
            if your final merit rank comes in lower. Ideal while awaiting results
            or comparing percentile vs. final State Merit Rank.
          </p>
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
                        inputType === t ? "bg-white text-[#172554] shadow-2xs" : "text-slate-500"
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
                onKeyDown={(e) => e.key === "Enter" && runSimulation()}
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
                onClick={runSimulation}
                disabled={loading}
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-slate-300 text-white font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {loading ? "Simulating..." : "Run Simulation"}
              </button>
            </div>
          </div>

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
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            Enter your score and press <strong>Run Simulation</strong> to see how
            your options change across a ±2 percentile window.
          </div>
        )}

        {data && basePoint && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Your Profile ({data.rank_scale_year} scale)
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-[#172554] mt-1.5">
                  {data.base_percentile.toFixed(2)}
                  <span className="text-sm text-slate-400"> %ile</span>
                </div>
                <div className="text-xs font-mono text-electric-blue mt-0.5">
                  ≈ State Merit Rank #{Math.round(data.base_rank).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Within Range Today
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 mt-1.5">
                  {basePoint.within_range}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  of {data.total_courses} matching course seats
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Unlocked with +1 %ile
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-electric-blue mt-1.5">
                  +{data.points.find((p) => p.delta === 1)?.changed_count ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  additional Within-Range course seats
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-6">
              <h2 className="text-lg font-bold text-[#172554] mb-1">
                Options by Simulated Score
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Click a bar to see the exact colleges gained or lost at that score.
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    onClick={(state: any) => {
                      const idx = state?.activeTooltipIndex;
                      if (idx != null && chartData[Number(idx)]) {
                        setSelectedDelta(chartData[Number(idx)].delta);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(79,70,229,0.06)" }}
                      contentStyle={{ borderRadius: 12, fontSize: 12, borderColor: "#E2E8F0" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Within Range" stackId="a" fill="#10B981" cursor="pointer">
                      {chartData.map((d) => (
                        <Cell
                          key={d.name}
                          fillOpacity={d.delta === selectedDelta || d.delta === 0 ? 1 : 0.55}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="Moderate" stackId="a" fill="#F59E0B" cursor="pointer" />
                    <Bar dataKey="Ambitious" stackId="a" fill="#6366F1" radius={[6, 6, 0, 0]} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Delta selector + changed list */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex flex-wrap gap-2">
                {data.points
                  .filter((p) => p.delta !== 0)
                  .map((p) => (
                    <button
                      key={p.delta}
                      type="button"
                      onClick={() => setSelectedDelta(p.delta)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                        selectedDelta === p.delta
                          ? p.delta > 0
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-rose-600 text-white border-rose-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {p.delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {formatDelta(p.delta)}
                      <span className="font-mono opacity-80">
                        ({p.delta > 0 ? "+" : "−"}
                        {p.changed_count})
                      </span>
                    </button>
                  ))}
              </div>

              {selectedPoint && (
                <div className="p-5 space-y-4">
                  <div className="text-sm text-slate-700">
                    {selectedPoint.delta > 0 ? (
                      <>
                        At{" "}
                        <strong className="font-mono">
                          {selectedPoint.percentile.toFixed(2)} %ile
                        </strong>{" "}
                        (≈ rank #{Math.round(selectedPoint.rank).toLocaleString()}) you
                        would <strong className="text-emerald-700">unlock {selectedPoint.changed_count}</strong>{" "}
                        more Within-Range course seats.
                      </>
                    ) : (
                      <>
                        At{" "}
                        <strong className="font-mono">
                          {selectedPoint.percentile.toFixed(2)} %ile
                        </strong>{" "}
                        (≈ rank #{Math.round(selectedPoint.rank).toLocaleString()}),{" "}
                        <strong className="text-rose-700">{selectedPoint.changed_count}</strong>{" "}
                        of today&apos;s Within-Range seats would slip out of reach — keep
                        enough Safe options in your form.
                      </>
                    )}
                  </div>

                  {selectedPoint.changed.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      No change for your current filters at this score.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[640px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-3">College</th>
                            <th className="py-2.5 px-3">Branch</th>
                            <th className="py-2.5 px-3 text-right">Cutoff %ile</th>
                            <th className="py-2.5 px-3 text-right">Cutoff Rank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {selectedPoint.changed.map((c) => (
                            <tr key={`${c.choice_code}-${c.branch}`} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3">
                                <Link
                                  href={`/college/${c.college_code}`}
                                  className="font-semibold text-[#172554] hover:text-electric-blue"
                                >
                                  {c.college_name}
                                </Link>
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span>{c.city}</span>
                                  <span>•</span>
                                  <span className="font-mono">{c.college_code}</span>
                                  {(c.official_website || c.cet_portal_url) && (
                                    <>
                                      <span>•</span>
                                      <a
                                        href={c.official_website || c.cet_portal_url || undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-mono font-semibold text-electric-blue hover:underline"
                                      >
                                        <Globe size={10} />
                                        {c.website_domain || "CET Profile"}
                                        <ExternalLink size={9} />
                                      </a>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{c.branch}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                                {c.historical_percentile.toFixed(2)}
                                {c.is_estimate && (
                                  <span className="ml-1 text-[10px] text-amber-600">est.</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-electric-blue">
                                #{Math.round(c.historical_rank).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {selectedPoint.changed_count > selectedPoint.changed.length && (
                        <div className="text-[11px] text-slate-400 pt-2">
                          Showing top {selectedPoint.changed.length} of{" "}
                          {selectedPoint.changed_count} by cutoff rank.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 rounded-2xl bg-[#EEF2FF]/70 border border-blue-100">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <Info size={15} className="text-electric-blue shrink-0 mt-0.5" />
                Simulations re-score the same historical CAP cutoffs (2023–2025)
                at each percentile; actual cutoffs vary year to year.
              </div>
              <Link
                href="/option-form"
                className="shrink-0 px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold flex items-center gap-1.5"
              >
                Build Option Form <ArrowRight size={13} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
