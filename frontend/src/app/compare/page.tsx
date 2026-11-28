"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Search,
  Building2,
  Loader2,
  Plus,
  X,
  BarChart2,
  Info,
  Sparkles,
  Bookmark,
  Globe,
  ExternalLink,
  Crown,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredBookmarks } from "@/components/NavigationShell";
import { showToast } from "@/components/ui/ToastProvider";
import { formatCategory } from "@/lib/categories";
import {
  PlanSession,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function Compare() {
  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });

  const [category, setCategory] = useState("GOPENS");
  const [year, setYear] = useState<number>(2026);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [categories, setCategories] = useState<string[]>([]);

  const proActive = isProActive(planSession);
  const maxColleges = proActive ? 4 : 2;

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);

    const syncPlan = () => setPlanSession(getStoredPlan());
    syncPlan();
    window.addEventListener("cap_plan_updated", syncPlan);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codesParam = params.get("colleges");
      if (codesParam) {
        const currentPro = isProActive(getStoredPlan());
        const cap = currentPro ? 4 : 2;
        const rawCodes = codesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, cap);
        if (rawCodes.length > 0) {
          Promise.all(
            rawCodes.map((c) =>
              axios
                .get(`${API_BASE}/colleges`, { params: { search: c, limit: 1 } })
                .then((res) => res.data.results?.[0])
                .catch(() => null)
            )
          ).then((found) => {
            const valid = found.filter(Boolean);
            if (valid.length > 0) {
              setSelectedCodes(valid);
            }
          });
        }
      }
    }

    return () => window.removeEventListener("cap_plan_updated", syncPlan);
  }, []);

  useEffect(() => {
    if (search.trim().length > 1) {
      axios
        .get(`${API_BASE}/colleges`, { params: { search, limit: 10 } })
        .then((res) => setColleges(res.data.results || []));
    } else {
      setColleges([]);
    }
  }, [search]);

  const addCollege = (c: any) => {
    if (selectedCodes.find((x) => x.college_code === c.college_code)) {
      setSearch("");
      return;
    }
    if (selectedCodes.length >= maxColleges) {
      if (!proActive) {
        openUpgradeModal(
          "pro",
          "Compare up to 4 colleges side-by-side with NIRF Median Salaries & FRA Fees"
        );
      }
      setSearch("");
      return;
    }
    setSelectedCodes([...selectedCodes, c]);
    setSearch("");
  };

  const removeCollege = (code: string) => {
    setSelectedCodes(selectedCodes.filter((c) => c.college_code !== code));
  };

  const loadPresetTopColleges = async () => {
    const presetCodes = proActive
      ? ["3012", "6006", "3215", "6271"]
      : ["3012", "6006"];
    setLoading(true);
    try {
      const found = await Promise.all(
        presetCodes.map((c) =>
          axios
            .get(`${API_BASE}/colleges`, { params: { search: c, limit: 1 } })
            .then((res) => res.data.results?.[0])
            .catch(() => null)
        )
      );
      const valid = found.filter(Boolean);
      setSelectedCodes(valid);
      const res = await axios.post(`${API_BASE}/compare`, {
        college_codes: valid.map((c: any) => c.college_code),
        category,
        year,
        round_number: roundNumber,
      });
      setComparisonData(res.data.comparison || []);
      setHasCompared(true);
    } catch {
      showToast("Unable to load preset comparison right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadFromShortlist = () => {
    const saved = getStoredBookmarks();
    const uniqueMap = new Map<string, any>();
    for (const item of saved) {
      if (!uniqueMap.has(item.college_code) && uniqueMap.size < maxColleges) {
        uniqueMap.set(item.college_code, {
          college_code: item.college_code,
          college_name: item.college_name,
          city: item.city,
        });
      }
    }
    if (uniqueMap.size > 0) {
      setSelectedCodes(Array.from(uniqueMap.values()));
    } else {
      showToast(
        "Shortlist is empty. Bookmark colleges in Predictor or Explorer first.",
        "info"
      );
    }
  };

  const runComparison = async () => {
    if (selectedCodes.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/compare`, {
        college_codes: selectedCodes.map((c) => c.college_code),
        category,
        year,
        round_number: roundNumber,
      });
      setComparisonData(res.data.comparison || []);
      setHasCompared(true);
    } catch {
      showToast("Unable to load comparison right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-[#F8FAFC] py-10 px-4 sm:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554]">
              Compare Colleges
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Side-by-side cutoffs, NIRF median salaries, and FRA annual fees.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={loadFromShortlist}
              className="px-3.5 py-2 text-xs font-semibold text-[#172554] bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Bookmark size={14} className="text-[#4F46E5]" /> Load Shortlist
            </button>
            <button
              type="button"
              onClick={loadPresetTopColleges}
              className="px-3.5 py-2 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#4F46E5]/20 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} />{" "}
              {proActive ? "VJTI vs COEP vs SPIT vs PICT" : "Compare VJTI vs COEP"}
            </button>
            {!proActive && (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal(
                    "pro",
                    "Unlock 4-college comparison + NIRF Median Salaries & FRA Fees"
                  )
                }
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Crown size={14} /> 4-College Pro (₹199)
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-[#E2E8F0] mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Selection Area */}
            <div className="flex-1 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-[#172554]">
                    Search &amp; Add Colleges ({selectedCodes.length}/{maxColleges}{" "}
                    {proActive ? "Pro" : "Free"})
                  </label>
                  {!proActive && (
                    <button
                      type="button"
                      onClick={() =>
                        openUpgradeModal(
                          "pro",
                          "Unlock 4-college side-by-side comparison with CAP Pro Pass"
                        )
                      }
                      className="text-xs font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Lock size={11} /> Unlock 4 Slots
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Type college name, DTE code (e.g. 3012, 6006, 6271), or city..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-[#E2E8F0] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 outline-none transition-all text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  {/* Dropdown Results */}
                  <AnimatePresence>
                    {colleges.length > 0 && search.trim().length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-[#E2E8F0] overflow-hidden max-h-64 overflow-y-auto"
                      >
                        {colleges.map((c, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => addCollege(c)}
                            className="w-full text-left px-5 py-3.5 hover:bg-[#F8FAFC] border-b border-[#E2E8F0] last:border-0 flex justify-between items-center transition-colors group cursor-pointer"
                          >
                            <div className="min-w-0 pr-4">
                              <div className="text-[11px] font-mono text-[#4F46E5] font-bold">
                                Code: {c.college_code} • {c.city}
                              </div>
                              <div className="text-sm font-semibold text-[#172554] truncate group-hover:text-[#4F46E5]">
                                {c.college_name}
                              </div>
                            </div>
                            <Plus
                              size={18}
                              className="text-slate-400 group-hover:text-[#4F46E5] shrink-0"
                            />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Selected Pills + Locked Pro Slot Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence>
                  {selectedCodes.map((c) => (
                    <motion.div
                      key={c.college_code}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-[#4F46E5]/30 p-4 rounded-xl flex justify-between items-start gap-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#4F46E5]" />
                      <div className="pl-2">
                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                          DTE Code: {c.college_code} • {c.city}
                        </div>
                        <div className="text-sm font-bold text-[#172554] line-clamp-2 leading-snug">
                          {c.college_name}
                        </div>
                        {(c.official_website || c.cet_portal_url) && (
                          <a
                            href={c.official_website || c.cet_portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#4F46E5] hover:underline mt-1"
                          >
                            <Globe size={11} />
                            {c.website_domain || "CET Cell Profile"}
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCollege(c.college_code)}
                        className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-1.5 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {!proActive && selectedCodes.length >= 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal(
                        "pro",
                        "Compare 4 colleges side-by-side with NIRF Placements & FRA Fees"
                      )
                    }
                    className="p-4 rounded-xl border border-dashed border-[#4F46E5]/40 bg-[#EEF2FF]/40 hover:bg-[#EEF2FF] text-left flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-[#4F46E5] flex items-center gap-1">
                        <Lock size={12} /> Slots #3 &amp; #4 + NIRF &amp; Fee Matrix
                      </div>
                      <div className="text-xs font-semibold text-[#172554] mt-1">
                        Add 2 more colleges &amp; unlock salary/fee rows (₹199)
                      </div>
                    </div>
                    <Crown size={18} className="text-[#4F46E5] shrink-0" />
                  </button>
                )}

                {selectedCodes.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 py-10 text-center flex flex-col items-center justify-center text-[#64748B] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-[#F8FAFC]">
                    <Building2 className="mb-2 text-slate-300" size={32} />
                    <p className="font-semibold text-[#172554] text-sm">
                      No colleges selected yet
                    </p>
                    <p className="text-xs mt-1">
                      Search above or click &quot;Compare VJTI vs COEP&quot; to start.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-80 flex flex-col justify-between space-y-5 border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-6 md:pt-0 md:pl-8">
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-4">
                <div className="flex gap-2 items-center text-sm font-bold text-[#172554]">
                  <Info size={16} className="text-[#4F46E5]" /> Settings
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Seat Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] focus:border-[#4F46E5] outline-none text-sm bg-white font-medium text-[#172554]"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] focus:border-[#4F46E5] outline-none text-sm bg-white font-medium text-[#172554]"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                      <option value={2024}>2024</option>
                      <option value={2023}>2023</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                      CAP Round
                    </label>
                    <select
                      value={roundNumber}
                      onChange={(e) => setRoundNumber(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] focus:border-[#4F46E5] outline-none text-sm bg-white font-medium text-[#172554]"
                    >
                      <option value={1}>Round 1</option>
                      <option value={2}>Round 2</option>
                      <option value={3}>Round 3</option>
                      <option value={4}>Round 4</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={runComparison}
                disabled={selectedCodes.length === 0 || loading}
                className="w-full bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white font-semibold px-4 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <BarChart2 size={18} /> Generate Comparison
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Results Table */}
        {comparisonData.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-md border border-[#E2E8F0] overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-[#172554] text-white">
                    <th className="p-5 font-bold text-sm w-[250px] sticky left-0 z-10 bg-[#172554]">
                      Metric / Branch
                    </th>
                    {selectedCodes.map((c) => (
                      <th
                        key={c.college_code}
                        className="p-5 font-semibold min-w-[220px] border-l border-white/10"
                      >
                        <div className="text-[10px] text-[#C7D2FE] font-bold uppercase tracking-widest mb-1">
                          Code: {c.college_code} • {c.city}
                        </div>
                        <Link
                          href={`/college/${c.college_code}`}
                          className="truncate block text-sm leading-tight hover:underline"
                          title={c.college_name}
                        >
                          {c.college_name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {/* Pro Benchmark Row 1: NIRF Median Salary */}
                  <tr className="bg-[#EEF2FF]/45">
                    <td className="p-4 text-xs font-extrabold uppercase tracking-wider text-[#172554] sticky left-0 bg-[#EEF2FF] border-r border-[#E2E8F0]">
                      NIRF UG Median Salary
                    </td>
                    {selectedCodes.map((c) => {
                      const sample = comparisonData.find(
                        (d) => d.college_code === c.college_code
                      );
                      const lpa = sample?.nirf_median_lpa ?? c.nirf_median_lpa;
                      return (
                        <td key={`nirf-${c.college_code}`} className="p-4">
                          {proActive ? (
                            lpa != null ? (
                              <span className="font-mono text-sm font-extrabold text-emerald-700">
                                ₹{Number(lpa).toFixed(2)} LPA
                              </span>
                            ) : (
                              <span className="text-xs text-[#64748B]">
                                Unreported in NIRF
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                openUpgradeModal(
                                  "pro",
                                  "Unlock verified NIRF Median Salary & FRA Fee comparison rows"
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] bg-white px-2.5 py-1 rounded-lg border border-[#4F46E5]/25 cursor-pointer"
                            >
                              <Lock size={11} /> Unlock NIRF Salary
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Pro Benchmark Row 2: Approved Annual Open Fee */}
                  <tr className="bg-[#F8FAFC]">
                    <td className="p-4 text-xs font-extrabold uppercase tracking-wider text-[#172554] sticky left-0 bg-[#F8FAFC] border-r border-[#E2E8F0]">
                      Approved Annual Fee
                    </td>
                    {selectedCodes.map((c) => {
                      const sample = comparisonData.find(
                        (d) => d.college_code === c.college_code
                      );
                      const fee = sample?.annual_fee_inr ?? c.annual_fee_inr;
                      return (
                        <td key={`fee-${c.college_code}`} className="p-4">
                          {proActive ? (
                            fee != null ? (
                              <span className="font-mono text-sm font-extrabold text-[#172554]">
                                ₹{(Number(fee) / 100000).toFixed(2)}L / yr
                              </span>
                            ) : (
                              <span className="text-xs text-[#64748B]">
                                Check FRA Portal
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                openUpgradeModal(
                                  "pro",
                                  "Unlock verified NIRF Median Salary & FRA Fee comparison rows"
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] bg-white px-2.5 py-1 rounded-lg border border-[#4F46E5]/25 cursor-pointer"
                            >
                              <Lock size={11} /> Unlock FRA Fee
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Branch Cutoff Rows */}
                  {Array.from(new Set(comparisonData.map((d) => d.branch_name)))
                    .sort()
                    .map((branch) => (
                      <tr
                        key={branch}
                        className="hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="p-5 text-sm font-bold text-[#172554] sticky left-0 bg-white border-r border-[#E2E8F0]">
                          {branch}
                        </td>
                        {selectedCodes.map((c) => {
                          const record = comparisonData.find(
                            (d) =>
                              d.college_code === c.college_code &&
                              d.branch_name === branch
                          );
                          return (
                            <td key={c.college_code} className="p-5">
                              {record ? (
                                <div className="space-y-1">
                                  <div className="text-xl font-extrabold font-mono text-[#172554] flex items-center gap-1.5">
                                    {record.percentile
                                      ? `${record.percentile.toFixed(2)}`
                                      : "-"}
                                    <span className="text-[10px] text-[#64748B] font-medium">
                                      %ILE
                                    </span>
                                    {record.is_estimate && (
                                      <span
                                        className="text-[10px] font-semibold bg-[#EEF2FF] text-[#4F46E5] px-1.5 py-0.5 rounded"
                                        title={`Calibrated from ${record.basis_category}`}
                                      >
                                        *Est
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-medium text-[#64748B]">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">
                                      Rank:{" "}
                                      {record.merit_rank
                                        ? Math.round(
                                            record.merit_rank
                                          ).toLocaleString()
                                        : "N/A"}
                                    </span>
                                    <span className="text-[11px]">
                                      ({record.year} R{record.round_number})
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-medium text-sm flex items-center gap-1">
                                  <X size={14} /> Not offered
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-medium text-[#64748B]">
              <span>
                Entries marked <strong>*Est</strong> use calibrated category fallbacks.
              </span>
              <span className="bg-white px-3 py-1 rounded border border-[#E2E8F0]">
                Category: <strong className="text-[#172554]">{category}</strong>{" "}
                &middot; Year: <strong>{year}</strong> &middot; Round:{" "}
                <strong>{roundNumber}</strong>
              </span>
            </div>
          </motion.div>
        ) : (
          hasCompared &&
          !loading && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-[#64748B]">
              No cutoff records found for the selected colleges.
            </div>
          )
        )}
      </div>
    </div>
  );
}
