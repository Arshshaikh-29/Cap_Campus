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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStoredBookmarks } from "@/components/NavigationShell";
import { formatCategory } from "@/lib/categories";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export default function Compare() {
  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [hasCompared, setHasCompared] = useState(false);

  const [category, setCategory] = useState("GOPENS");
  const [year, setYear] = useState<number>(2026);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codesParam = params.get("colleges");
      if (codesParam) {
        const rawCodes = codesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 4);
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
    if (
      selectedCodes.length < 4 &&
      !selectedCodes.find((x) => x.college_code === c.college_code)
    ) {
      setSelectedCodes([...selectedCodes, c]);
    }
    setSearch("");
  };

  const removeCollege = (code: string) => {
    setSelectedCodes(selectedCodes.filter((c) => c.college_code !== code));
  };

  const loadPresetTopColleges = async () => {
    const presetCodes = ["3012", "6006", "3215", "6271"];
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
      alert("Unable to load preset comparison right now. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const loadFromShortlist = () => {
    const saved = getStoredBookmarks();
    const uniqueMap = new Map<string, any>();
    for (const item of saved) {
      if (!uniqueMap.has(item.college_code) && uniqueMap.size < 4) {
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
      alert("Your shortlist is currently empty. Bookmark colleges in the Predictor or Explorer first!");
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
      alert("Unable to load preset comparison right now. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554]">
              Compare Colleges
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Compare up to 4 colleges side-by-side by branch and category.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={loadFromShortlist}
              className="px-3.5 py-2 text-xs font-semibold text-primary bg-white hover:bg-soft-bg border border-border rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Bookmark size={14} className="text-electric-blue" /> Load from
              Shortlist
            </button>
            <button
              type="button"
              onClick={loadPresetTopColleges}
              className="px-3.5 py-2 text-xs font-semibold text-electric-blue bg-electric-blue/10 hover:bg-electric-blue/20 border border-electric-blue/20 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} /> Compare VJTI vs COEP vs SPIT vs PICT
            </button>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-border mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Selection Area */}
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">
                  Search & Add Colleges ({selectedCodes.length}/4)
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Type college name, DTE code (e.g. 3012, 6006, 6271), or city..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={selectedCodes.length >= 4}
                  />

                  {/* Dropdown Results */}
                  <AnimatePresence>
                    {colleges.length > 0 && search.trim().length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-border overflow-hidden max-h-64 overflow-y-auto"
                      >
                        {colleges.map((c, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => addCollege(c)}
                            className="w-full text-left px-5 py-3.5 hover:bg-soft-bg border-b border-border last:border-0 flex justify-between items-center transition-colors group cursor-pointer"
                          >
                            <div className="min-w-0 pr-4">
                              <div className="text-[11px] font-mono text-electric-blue font-bold">
                                Code: {c.college_code} • {c.city}
                              </div>
                              <div className="text-sm font-semibold text-primary truncate group-hover:text-electric-blue">
                                {c.college_name}
                              </div>
                            </div>
                            <Plus
                              size={18}
                              className="text-gray-400 group-hover:text-electric-blue shrink-0"
                            />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Selected Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence>
                  {selectedCodes.map((c) => (
                    <motion.div
                      key={c.college_code}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-electric-blue/30 shadow-sm p-4 rounded-xl flex justify-between items-start gap-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-electric-blue" />
                      <div className="pl-2">
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                          DTE Code: {c.college_code} • {c.city}
                        </div>
                        <div className="text-sm font-bold text-primary line-clamp-2 leading-snug">
                          {c.college_name}
                        </div>
                        {(c.official_website || c.cet_portal_url) && (
                          <a
                            href={c.official_website || c.cet_portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-electric-blue hover:underline mt-1"
                          >
                            <Globe size={11} />
                            {c.website_domain || "CET Cell Profile"}
                            <ExternalLink size={10} />
                          </a>
                        )}
                        {(c.nirf_median_lpa != null || c.annual_fee_inr != null) && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {c.nirf_median_lpa != null && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                NIRF: ₹{Number(c.nirf_median_lpa).toFixed(1)} LPA
                              </span>
                            )}
                            {c.annual_fee_inr != null && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Fee: ₹{(c.annual_fee_inr / 100000).toFixed(2)}L/yr
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCollege(c.college_code)}
                        className="text-gray-400 hover:text-rose-500 bg-gray-50 hover:bg-rose-50 p-1.5 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {selectedCodes.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 py-10 text-center flex flex-col items-center justify-center text-text-secondary border-2 border-dashed border-border rounded-xl bg-gray-50/50">
                    <Building2 className="mb-2 text-gray-300" size={32} />
                    <p className="font-medium text-primary">
                      No colleges selected yet
                    </p>
                    <p className="text-xs mt-1">
                      Search above or click &quot;Compare VJTI vs COEP vs SPIT
                      vs PICT&quot; to start immediately.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-80 flex flex-col justify-between space-y-5 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
              <div className="bg-soft-bg p-4 rounded-xl border border-border space-y-4">
                <div className="flex gap-2 items-center text-sm font-bold text-primary">
                  <Info size={16} className="text-electric-blue" /> Comparison
                  Settings
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Seat Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white font-medium text-primary"
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                      Academic Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white font-medium text-primary"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                      <option value={2024}>2024</option>
                      <option value={2023}>2023</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                      CAP Round
                    </label>
                    <select
                      value={roundNumber}
                      onChange={(e) => setRoundNumber(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white font-medium text-primary"
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
                className="w-full bg-primary hover:bg-navy-800 disabled:opacity-50 text-white font-semibold px-4 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
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
            className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-5 font-bold text-sm w-[260px] sticky left-0 z-10 bg-primary shadow-[1px_0_0_rgba(255,255,255,0.1)]">
                      Engineering Branch
                    </th>
                    {selectedCodes.map((c) => (
                      <th
                        key={c.college_code}
                        className="p-5 font-semibold min-w-[220px] border-l border-navy-700/50"
                      >
                        <div className="text-[10px] text-electric-blue font-bold uppercase tracking-widest mb-1">
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
                <tbody className="divide-y divide-border">
                  {Array.from(new Set(comparisonData.map((d) => d.branch_name)))
                    .sort()
                    .map((branch) => (
                      <tr
                        key={branch}
                        className="hover:bg-soft-bg/50 transition-colors"
                      >
                        <td className="p-5 text-sm font-bold text-primary sticky left-0 bg-white border-r border-border shadow-[1px_0_0_rgba(0,0,0,0.05)]">
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
                                  <div className="text-xl font-extrabold text-primary flex items-center gap-1.5">
                                    {record.percentile
                                      ? `${record.percentile.toFixed(2)}`
                                      : "-"}
                                    <span className="text-[10px] text-text-secondary font-medium">
                                      %ILE
                                    </span>
                                    {record.is_estimate && (
                                      <span
                                        className="text-[10px] font-semibold bg-warning/10 text-warning px-1.5 py-0.5 rounded"
                                        title={`Calibrated from ${record.basis_category}`}
                                      >
                                        *Est ({record.basis_category})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">
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
                                <span className="text-gray-300 font-medium text-sm flex items-center gap-1">
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
            <div className="p-4 bg-soft-bg border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs font-medium text-text-secondary">
              <span>
                Entries marked <strong>*Est</strong> use calibrated category
                fallbacks where the exact seat category had no State-Level row.
              </span>
              <span className="bg-white px-3 py-1 rounded border border-border shadow-2xs">
                Category: <strong className="text-primary">{category}</strong>{" "}
                &middot; Target Year: <strong>{year}</strong> &middot; Target
                Round: <strong>{roundNumber}</strong>
              </span>
            </div>
          </motion.div>
        ) : (
          hasCompared &&
          !loading && (
            <div className="bg-white rounded-2xl border border-border p-12 text-center text-text-secondary">
              No cutoff records found for the selected colleges.
            </div>
          )
        )}
      </div>
    </div>
  );
}
