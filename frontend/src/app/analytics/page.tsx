"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Search,
  Loader2,
  TrendingUp,
  BarChart3,
  Building2,
  BookOpen,
  Sparkles,
  Award,
  Layers,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCategory } from "@/lib/categories";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function Analytics() {
  const [search, setSearch] = useState("");
  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<any>(null);

  const [category, setCategory] = useState("GOPENS");
  const [branch, setBranch] = useState("");

  const [globalFilters, setGlobalFilters] = useState<{
    categories: string[];
    branches: string[];
  }>({
    categories: [],
    branches: [],
  });
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [basisCategory, setBasisCategory] = useState<string | null>(null);
  const [isEstimate, setIsEstimate] = useState<boolean>(false);
  const [branchComparison, setBranchComparison] = useState<any[]>([]);
  const [categoryComparison, setCategoryComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setGlobalFilters(res.data))
      .catch(() => undefined);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const colParam = params.get("college");
      const brParam = params.get("branch");
      const catParam = params.get("category");
      if (catParam) setCategory(catParam);
      if (brParam) setBranch(brParam);
      if (colParam) {
        axios
          .get(`${API_BASE}/colleges/${colParam}`)
          .then((res) => {
            setSelectedCollege({
              college_code: res.data.college_code,
              college_name: res.data.college_name,
              city: res.data.city,
            });
            const brs = res.data.branches || [];
            setAvailableBranches(brs);
            if (brParam && brs.includes(brParam)) {
              setBranch(brParam);
            } else if (brs.length > 0) {
              setBranch(brs[0]);
            }
          })
          .catch(() => undefined);
      }
    }
  }, []);

  useEffect(() => {
    if (search.trim().length > 1) {
      axios
        .get(`${API_BASE}/colleges`, { params: { search, limit: 8 } })
        .then((res) => setColleges(res.data.results || []))
        .catch(() => undefined);
    } else {
      setColleges([]);
    }
  }, [search]);

  const selectQuickCollege = (code: string) => {
    axios
      .get(`${API_BASE}/colleges/${code}`)
      .then((res) => {
        setSelectedCollege({
          college_code: res.data.college_code,
          college_name: res.data.college_name,
          city: res.data.city,
        });
        const brs = res.data.branches || [];
        setAvailableBranches(brs);
        const pref =
          brs.find((b: string) => b === "Computer Engineering") ||
          brs.find((b: string) => b === "Computer Science and Engineering") ||
          brs[0] ||
          "";
        setBranch(pref);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (selectedCollege) {
      axios
        .get(`${API_BASE}/colleges/${selectedCollege.college_code}`)
        .then((res) => {
          const branches = res.data.branches || [];
          setAvailableBranches(branches);
          if (branches.length > 0 && !branches.includes(branch)) {
            const pref =
              branches.find((b: string) => b === "Computer Engineering") ||
              branches.find(
                (b: string) => b === "Computer Science and Engineering"
              ) ||
              branches[0];
            setBranch(pref);
          }
        })
        .catch(() => undefined);
    } else {
      setAvailableBranches(globalFilters.branches);
    }
  }, [selectedCollege]);

  useEffect(() => {
    if (selectedCollege && branch && category) {
      setLoading(true);
      axios
        .get(`${API_BASE}/analytics/cutoffs`, {
          params: {
            college_code: selectedCollege.college_code,
            branch,
            category,
          },
        })
        .then((res) => {
          const trends = (res.data.trends || []).map((t: any) => ({
            name: `${t.year} R${t.round_number}`,
            percentile: t.percentile ? Number(t.percentile.toFixed(2)) : 0,
            rank: t.merit_rank ? Math.round(t.merit_rank) : 0,
            year: t.year,
            round: t.round_number,
            category: t.category,
          }));
          setAnalyticsData(trends);
          setSummary(res.data.summary || null);
          setBasisCategory(res.data.basis_category || null);
          setIsEstimate(Boolean(res.data.is_estimate));
          setBranchComparison(res.data.branch_comparison || []);
          setCategoryComparison(res.data.category_comparison || []);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  }, [selectedCollege, branch, category]);

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">
              Cutoff Analytics & Projections
            </h1>
            <p className="text-text-secondary text-base">
              Analyze multi-year percentile trajectories, merit rank shifts, and
              branch/category benchmarks across 2023–2025 CAP rounds.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { code: "3012", label: "VJTI Mumbai" },
              { code: "6006", label: "COEP Pune" },
              { code: "6271", label: "PICT Pune" },
              { code: "3215", label: "SPIT Mumbai" },
              { code: "6007", label: "Walchand Sangli" },
            ].map((q) => (
              <button
                type="button"
                key={q.code}
                onClick={() => selectQuickCollege(q.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  selectedCollege?.college_code === q.code
                    ? "bg-electric-blue text-white border-electric-blue"
                    : "bg-white text-primary border-border hover:border-electric-blue/40"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-6 items-end relative z-20">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
              Target Institution
            </label>
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search college by name, DTE code (e.g. 6006, 3012), or city..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all text-primary font-medium text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <AnimatePresence>
                {colleges.length > 0 && search.trim().length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute w-full mt-2 bg-white rounded-xl shadow-xl border border-border overflow-hidden max-h-64 overflow-y-auto z-30"
                  >
                    {colleges.map((c, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => {
                          setSelectedCollege(c);
                          setSearch("");
                          setColleges([]);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-soft-bg border-b border-border last:border-0 text-sm font-semibold text-primary cursor-pointer"
                      >
                        <span className="font-mono text-xs text-electric-blue mr-2">
                          [{c.college_code}]
                        </span>
                        {c.college_name} ({c.city})
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="w-full md:w-72">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
              Branch
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none text-sm font-medium bg-white text-primary"
            >
              {availableBranches.map((b: string) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-64">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none text-sm font-medium bg-white text-primary"
            >
              {globalFilters.categories.map((c: string) => (
                <option key={c} value={c}>
                  {formatCategory(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard Panels */}
        {!selectedCollege ? (
          <div className="bg-white border border-border rounded-2xl p-20 text-center shadow-sm space-y-4">
            <BarChart3
              className="mx-auto text-gray-300"
              size={48}
              strokeWidth={1.5}
            />
            <h3 className="text-xl font-bold text-primary">
              Select an Institution to Begin
            </h3>
            <p className="text-text-secondary text-sm max-w-md mx-auto">
              Search for any college above or click one of the quick-select
              buttons (VJTI, COEP, PICT, SPIT, Walchand) to inspect multi-year
              cutoff analytics.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Banner */}
            <div className="bg-primary text-white p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-full bg-electric-blue/20 blur-3xl transform translate-x-1/2" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-electric-blue font-bold text-xs uppercase tracking-wider mb-2">
                  <Building2 size={14} /> DTE Code:{" "}
                  {selectedCollege.college_code} &middot; {selectedCollege.city}
                </div>
                <h2 className="text-2xl font-bold">
                  {selectedCollege.college_name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-gray-300 mt-2 text-sm">
                  <BookOpen size={16} /> <span>{branch}</span> &middot;{" "}
                  <span>Requested: {category}</span>
                  {basisCategory && (
                    <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono">
                      Basis: {basisCategory}
                      {isEstimate ? " (*Fallback)" : ""}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/college/${selectedCollege.college_code}`}
                className="relative z-10 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                Institute Profile <ExternalLink size={14} />
              </Link>
            </div>

            {/* Summary KPI Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Latest Closing Cutoff ({summary.latest?.year} R
                    {summary.latest?.round_number})
                  </div>
                  <div className="text-2xl font-extrabold text-primary font-mono mt-1.5">
                    {summary.latest?.percentile != null
                      ? `${summary.latest.percentile.toFixed(2)} %ile`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-text-secondary mt-1 font-mono">
                    Merit Rank:{" "}
                    {summary.latest?.merit_rank != null
                      ? Math.round(summary.latest.merit_rank).toLocaleString()
                      : "N/A"}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Year-over-Year Shift
                  </div>
                  <div
                    className={`text-2xl font-extrabold font-mono mt-1.5 ${
                      (summary.yoy_percentile_change || 0) >= 0
                        ? "text-electric-blue"
                        : "text-teal-accent"
                    }`}
                  >
                    {summary.yoy_percentile_change != null
                      ? `${
                          summary.yoy_percentile_change > 0 ? "+" : ""
                        }${summary.yoy_percentile_change.toFixed(2)} %ile`
                      : "Stable"}
                  </div>
                  <div className="text-xs text-text-secondary mt-1 capitalize">
                    Overall Trend: <strong>{summary.trend}</strong>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-border shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Round 1 → Final Round Relaxation
                  </div>
                  <div className="text-2xl font-extrabold text-primary font-mono mt-1.5">
                    {summary.round_drop_percentile != null
                      ? `${summary.round_drop_percentile.toFixed(2)} %ile`
                      : "0.00 %ile"}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    Peak: {summary.peak_percentile?.toFixed(2)}% • Low:{" "}
                    {summary.lowest_percentile?.toFixed(2)}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-electric-blue/30 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-electric-blue flex items-center gap-1">
                    <Sparkles size={13} /> Projected {summary.outlook?.year || 2026}{" "}
                    Band
                  </div>
                  <div className="text-2xl font-extrabold text-primary font-mono mt-1.5">
                    {summary.outlook
                      ? `${summary.outlook.low.toFixed(2)} – ${summary.outlook.high.toFixed(2)}%`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    Historical trajectory range
                  </div>
                </div>
              </div>
            )}

            {/* Trajectory Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Line Chart Panel */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col h-[390px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-primary text-lg">
                    Percentile Trajectory (2023–2025)
                  </h3>
                  <TrendingUp className="text-electric-blue" size={20} />
                </div>
                {loading ? (
                  <div className="flex-1 flex justify-center items-center">
                    <Loader2 className="animate-spin text-electric-blue" />
                  </div>
                ) : analyticsData.length === 0 ? (
                  <div className="flex-1 flex justify-center items-center text-text-secondary text-sm">
                    No data available for this combination.
                  </div>
                ) : (
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsData}
                        margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorPct"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#2563EB"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#2563EB"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#eaecf0"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#667085" }}
                          dy={10}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#667085" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #eaecf0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="percentile"
                          stroke="#2563EB"
                          strokeWidth={3}
                          fill="url(#colorPct)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bar Chart Panel */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col h-[390px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-primary text-lg">
                    Merit Rank Movement
                  </h3>
                  <BarChart3 className="text-primary" size={20} />
                </div>
                {loading ? (
                  <div className="flex-1 flex justify-center items-center">
                    <Loader2 className="animate-spin text-electric-blue" />
                  </div>
                ) : analyticsData.length === 0 ? (
                  <div className="flex-1 flex justify-center items-center text-text-secondary text-sm">
                    No data available for this combination.
                  </div>
                ) : (
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analyticsData}
                        margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#eaecf0"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#667085" }}
                          dy={10}
                        />
                        <YAxis
                          domain={[0, "auto"]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#667085" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #eaecf0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          cursor={{ fill: "#F6F8FC" }}
                        />
                        <Bar
                          dataKey="rank"
                          fill="#0F172A"
                          radius={[6, 6, 0, 0]}
                          barSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-4 text-center text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Closing State Merit Rank per CAP Round
                </div>
              </div>
            </div>

            {/* Branch Comparison & Category Comparison Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Branch Comparison */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <h3 className="font-bold text-primary text-base flex items-center gap-2">
                    <Layers size={18} className="text-electric-blue" /> All
                    Branches at {selectedCollege.college_code} ({category})
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary uppercase">
                        <th className="py-2.5 px-3">Branch</th>
                        <th className="py-2.5 px-3">Basis</th>
                        <th className="py-2.5 px-3 text-right">Percentile</th>
                        <th className="py-2.5 px-3 text-right">Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {branchComparison.map((b, i) => (
                        <tr
                          key={i}
                          onClick={() => setBranch(b.branch)}
                          className={`cursor-pointer transition-colors ${
                            b.branch === branch
                              ? "bg-electric-blue/10 font-bold"
                              : "hover:bg-soft-bg"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-primary">
                            {b.branch}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-text-secondary">
                            {b.category} ({b.year} R{b.round_number})
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-electric-blue">
                            {b.percentile?.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-primary">
                            {b.merit_rank
                              ? Math.round(b.merit_rank).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Comparison */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                  <h3 className="font-bold text-primary text-base flex items-center gap-2">
                    <Award size={18} className="text-teal-accent" /> Seat
                    Category Breakdown ({branch})
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-secondary uppercase">
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Round</th>
                        <th className="py-2.5 px-3 text-right">Percentile</th>
                        <th className="py-2.5 px-3 text-right">Merit Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {categoryComparison.map((c, i) => (
                        <tr
                          key={i}
                          onClick={() => setCategory(c.category)}
                          className={`cursor-pointer transition-colors ${
                            c.category === category
                              ? "bg-electric-blue/10 font-bold"
                              : "hover:bg-soft-bg"
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-primary">
                            {c.category}
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary">
                            {c.year} R{c.round_number}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-electric-blue">
                            {c.percentile?.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-primary">
                            {c.merit_rank
                              ? Math.round(c.merit_rank).toLocaleString()
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
