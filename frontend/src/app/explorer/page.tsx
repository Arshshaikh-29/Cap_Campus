"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Search,
  MapPin,
  Building2,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  Bookmark,
  Scale,
  Globe,
  ExternalLink,
} from "lucide-react";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function ExplorerPage() {
  const [colleges, setColleges] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "name_desc" | "code" | "city">(
    "name"
  );
  const [filters, setFilters] = useState<{
    cities: string[];
    branches: string[];
  }>({
    cities: [],
    branches: [],
  });
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setFilters(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const sync = () => setBookmarks(getStoredBookmarks());
    sync();
    window.addEventListener("cap_bookmarks_updated", sync);
    return () => window.removeEventListener("cap_bookmarks_updated", sync);
  }, []);

  const bookmarkedColleges = useMemo(
    () => new Set(bookmarks.map((b) => b.college_code)),
    [bookmarks]
  );

  const toggleCollegeBookmark = (e: React.MouseEvent, c: any) => {
    e.preventDefault();
    e.stopPropagation();
    const existing = getStoredBookmarks();
    const hasCollege = existing.some(
      (item) => item.college_code === c.college_code
    );
    if (hasCollege) {
      saveStoredBookmarks(
        existing.filter((item) => item.college_code !== c.college_code)
      );
    } else {
      saveStoredBookmarks([
        ...existing,
        {
          key: `${c.college_code}|${branch || "General"}`,
          college_code: c.college_code,
          college_name: c.college_name,
          city: c.city,
          branch: branch || "All Branches",
        },
      ]);
    }
  };

  const fetchColleges = (resetOffset = true) => {
    const nextOffset = resetOffset ? 0 : colleges.length;
    if (resetOffset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (city) params.append("city", city);
    if (branch) params.append("branch", branch);
    params.append("sort_by", sortBy);
    params.append("limit", "60");
    params.append("offset", String(nextOffset));

    axios
      .get(`${API_BASE}/colleges?${params.toString()}`)
      .then((res) => {
        const incoming = res.data.results || [];
        setTotal(res.data.total || incoming.length);
        setColleges((prev) =>
          resetOffset ? incoming : [...prev, ...incoming]
        );
      })
      .catch(() => undefined)
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchColleges(true);
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [search, city, branch, sortBy]);

  return (
    <div className="flex-1 bg-soft-bg py-12 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header & Search */}
        <div className="bg-white rounded-3xl p-8 border border-border shadow-xs space-y-6">
          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554] tracking-tight">
              College Explorer
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              400 Maharashtra engineering colleges • 2023–2026 CAP cutoffs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
            <div className="md:col-span-5 relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                type="text"
                placeholder="Search by college name, DTE code (e.g. 6006, 3012), or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-soft-bg border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue text-sm font-medium"
              />
            </div>

            <div className="md:col-span-3 relative">
              <MapPin
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-soft-bg border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue text-sm font-medium text-primary"
              >
                <option value="">All Cities</option>
                {filters.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 relative">
              <SlidersHorizontal
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-soft-bg border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue text-sm font-medium text-primary"
              >
                <option value="">All Branches</option>
                {filters.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
            <span className="text-sm font-semibold text-text-secondary">
              {loading
                ? "Searching..."
                : `Showing ${colleges.length} of ${total} institutes`}
            </span>
            <div className="flex items-center gap-3">
              {(search || city || branch) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCity("");
                    setBranch("");
                  }}
                  className="text-xs font-semibold text-electric-blue hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-white px-3 py-2 rounded-lg border border-border shadow-2xs">
                <ArrowUpDown size={14} className="text-electric-blue" />
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer"
                >
                  <option value="name">Name (A → Z)</option>
                  <option value="name_desc">Name (Z → A)</option>
                  <option value="code">DTE Code (Ascending)</option>
                  <option value="city">City (A → Z)</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 border border-border h-48 animate-pulse flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-16 h-4 bg-gray-200 rounded" />
                    <div className="w-full h-6 bg-gray-200 rounded" />
                    <div className="w-2/3 h-4 bg-gray-200 rounded" />
                  </div>
                  <div className="w-24 h-4 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : colleges.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-16 text-center space-y-3">
              <Building2
                size={40}
                className="mx-auto text-text-secondary/50"
              />
              <h3 className="text-lg font-bold text-primary">
                No colleges match your criteria
              </h3>
              <p className="text-sm text-text-secondary">
                Try clearing some filters or searching with a broader keyword.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCity("");
                  setBranch("");
                }}
                className="mt-4 px-5 py-2 bg-electric-blue text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {colleges.map((c, i) => {
                  const isSaved = bookmarkedColleges.has(c.college_code);
                  return (
                    <div
                      key={`${c.college_code}-${i}`}
                      className="bg-white rounded-2xl p-6 border border-border hover:border-electric-blue/50 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-mono font-semibold text-electric-blue bg-electric-blue/10 px-2.5 py-1 rounded-md">
                            Code: {c.college_code}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary flex items-center gap-1 font-medium">
                              <MapPin size={12} /> {c.city}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => toggleCollegeBookmark(e, c)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isSaved
                                  ? "text-electric-blue bg-electric-blue/10 border-electric-blue/30"
                                  : "text-text-secondary hover:text-primary bg-soft-bg border-border"
                              }`}
                              title={
                                isSaved
                                  ? "Remove from Shortlist"
                                  : "Save to Shortlist"
                              }
                            >
                              <Bookmark
                                size={14}
                                className={
                                  isSaved ? "fill-electric-blue" : ""
                                }
                              />
                            </button>
                          </div>
                        </div>
                        <Link
                          href={`/college/${c.college_code}`}
                          className="block font-bold text-primary text-base line-clamp-2 group-hover:text-electric-blue transition-colors"
                        >
                          {c.college_name}
                        </Link>
                        {(c.official_website || c.cet_portal_url) && (
                          <a
                            href={c.official_website || c.cet_portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-slate-600 hover:text-electric-blue bg-slate-50 hover:bg-electric-blue/5 border border-[#E2E8F0] hover:border-electric-blue/30 px-2.5 py-1 rounded-lg transition-colors max-w-full truncate"
                          >
                            <Globe size={11} className="text-electric-blue shrink-0" />
                            <span className="truncate">
                              {c.website_domain || "CET Cell Official Profile"}
                            </span>
                            <ExternalLink size={10} className="shrink-0 opacity-70" />
                          </a>
                        )}
                        {(c.nirf_median_lpa != null || c.annual_fee_inr != null) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {c.nirf_median_lpa != null && (
                              <span
                                title="NIRF Engineering UG Median Package"
                                className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                              >
                                NIRF: ₹{Number(c.nirf_median_lpa).toFixed(1)} LPA
                              </span>
                            )}
                            {c.annual_fee_inr != null && (
                              <span
                                title={
                                  c.fee_source_type === "FRA"
                                    ? "Maharashtra FRA Approved Annual Fee"
                                    : "Official Govt./Institute Annual Fee"
                                }
                                className="text-[10px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                Fee: ₹{(c.annual_fee_inr / 100000).toFixed(2)}L/yr
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-6 mt-6 border-t border-border flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/analytics?college=${c.college_code}`}
                            className="text-xs font-semibold text-text-secondary hover:text-electric-blue transition-colors"
                          >
                            Cutoff Trends
                          </Link>
                          <span className="text-border">•</span>
                          <Link
                            href={`/compare?colleges=${c.college_code}`}
                            className="text-xs font-semibold text-text-secondary hover:text-electric-blue transition-colors inline-flex items-center gap-1"
                          >
                            <Scale size={12} /> Compare
                          </Link>
                        </div>
                        <Link
                          href={`/college/${c.college_code}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-electric-blue hover:underline"
                        >
                          Profile <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {colleges.length < total && (
                <div className="pt-6 text-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => fetchColleges(false)}
                    className="bg-white hover:bg-soft-bg text-primary font-semibold px-6 py-3 rounded-xl border border-border shadow-xs transition-all text-sm cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore
                      ? "Loading..."
                      : `Load More Institutes (${total - colleges.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
