"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  MapPin,
  BookOpen,
  Award,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Bookmark,
  Scale,
  Globe,
  Briefcase,
  IndianRupee,
  Building2,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";
import { CATEGORY_LABELS, formatCategory } from "@/lib/categories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const QUICK_CATEGORIES = [
  "GOPENS",
  "GOPENH",
  "GOBCS",
  "GSEBCS",
  "EWS",
  "TFWS",
  "GSCS",
  "GSTS",
  "GVJS",
  "GNT1S",
  "GNT2S",
  "GNT3S",
  "LOPENS",
  "MI",
];

export default function CollegeDetailPage() {
  const { id } = useParams();
  const [college, setCollege] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);

  useEffect(() => {
    if (id) {
      axios
        .get(`${API_BASE}/colleges/${id}`)
        .then((res) => setCollege(res.data))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    const sync = () => setBookmarks(getStoredBookmarks());
    sync();
    window.addEventListener("cap_bookmarks_updated", sync);
    return () => window.removeEventListener("cap_bookmarks_updated", sync);
  }, []);

  const isCollegeBookmarked = useMemo(
    () =>
      college
        ? bookmarks.some((b) => b.college_code === college.college_code)
        : false,
    [bookmarks, college]
  );

  const toggleCollegeBookmark = () => {
    if (!college) return;
    const existing = getStoredBookmarks();
    if (isCollegeBookmarked) {
      saveStoredBookmarks(
        existing.filter((b) => b.college_code !== college.college_code)
      );
    } else {
      saveStoredBookmarks([
        ...existing,
        {
          key: `${college.college_code}|${
            selectedBranch || college.branches?.[0] || "All Branches"
          }`,
          college_code: college.college_code,
          college_name: college.college_name,
          city: college.city,
          branch: selectedBranch || college.branches?.[0] || "All Branches",
        },
      ]);
    }
  };

  const availableCategories = useMemo(() => {
    if (!college?.recent_cutoffs) return [];
    return Array.from(
      new Set(college.recent_cutoffs.map((r: any) => r.category).filter(Boolean))
    ).sort() as string[];
  }, [college]);

  const availableYears = useMemo(() => {
    if (!college?.recent_cutoffs) return [];
    return Array.from(
      new Set(
        college.recent_cutoffs.map((r: any) => String(r.year)).filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a)) as string[];
  }, [college]);

  const filteredCutoffs = useMemo(() => {
    if (!college?.recent_cutoffs) return [];
    return college.recent_cutoffs.filter((r: any) => {
      if (selectedBranch && r.branch_name !== selectedBranch) return false;
      if (selectedCategory && r.category !== selectedCategory) return false;
      if (selectedYear && String(r.year) !== selectedYear) return false;
      if (selectedRound && String(r.round_number) !== selectedRound)
        return false;
      return true;
    });
  }, [
    college,
    selectedBranch,
    selectedCategory,
    selectedYear,
    selectedRound,
  ]);

  if (loading) {
    return (
      <div className="flex-1 bg-soft-bg py-12 px-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-electric-blue" />
      </div>
    );
  }

  if (!college) {
    return (
      <div className="flex-1 bg-soft-bg py-12 px-6 text-center space-y-4">
        <h2 className="text-2xl font-bold text-primary">College Not Found</h2>
        <Link
          href="/explorer"
          className="text-electric-blue hover:underline text-sm font-semibold inline-block"
        >
          Return to Explorer
        </Link>
      </div>
    );
  }

  const directWebsiteUrl: string | null = college.official_website || null;
  const cetPortalUrl: string | null = college.cet_portal_url || null;
  const officialSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${college.college_name} ${college.city} official website`
  )}`;

  const quickChips = QUICK_CATEGORIES.filter((c) =>
    availableCategories.includes(c)
  );

  return (
    <div className="flex-1 bg-soft-bg py-10 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Back Link */}
        <Link
          href="/explorer"
          className="inline-flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-primary uppercase tracking-wider transition-colors"
        >
          <ArrowLeft size={14} /> Back to Explorer
        </Link>

        {/* College Header Card */}
        <div className="bg-white rounded-3xl p-8 border border-border shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-electric-blue/10 to-transparent rounded-full blur-2xl -z-10" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-white bg-primary px-3 py-1 rounded-md">
                  DTE Code: {college.college_code}
                </span>
                <span className="text-xs font-semibold text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-md flex items-center gap-1">
                  <ShieldCheck size={14} /> State CET Cell Verified
                </span>
                {college.is_autonomous && (
                  <span className="text-xs font-semibold text-electric-blue bg-electric-blue/10 border border-electric-blue/20 px-2.5 py-1 rounded-md">
                    Autonomous / State-Level Pool
                  </span>
                )}
                {college.is_minority && (
                  <span className="text-xs font-semibold text-warning bg-warning/10 border border-warning/20 px-2.5 py-1 rounded-md">
                    Minority Institute (MI Quota)
                  </span>
                )}
                <span className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <MapPin size={14} className="text-electric-blue" />{" "}
                  {college.city}, Maharashtra
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">
                {college.college_name}
              </h1>
              {(directWebsiteUrl || cetPortalUrl) && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  {directWebsiteUrl && (
                    <a
                      href={directWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono font-semibold text-electric-blue hover:underline bg-electric-blue/5 border border-electric-blue/20 px-2.5 py-1 rounded-lg"
                    >
                      <Globe size={13} />
                      {college.website_domain || directWebsiteUrl}
                      <ExternalLink size={11} />
                    </a>
                  )}
                  {cetPortalUrl && (
                    <a
                      href={cetPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-electric-blue hover:underline"
                    >
                      <ShieldCheck size={13} className="text-emerald-600" />
                      CET Cell Institute Summary
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={toggleCollegeBookmark}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isCollegeBookmarked
                    ? "bg-electric-blue/10 text-electric-blue border-electric-blue/30"
                    : "bg-soft-bg hover:bg-gray-200 text-primary border-border"
                }`}
              >
                <Bookmark
                  size={14}
                  className={isCollegeBookmarked ? "fill-electric-blue" : ""}
                />
                {isCollegeBookmarked ? "Shortlisted" : "Shortlist"}
              </button>
              <Link
                href={`/compare?colleges=${college.college_code}`}
                className="px-4 py-2.5 bg-soft-bg hover:bg-gray-200 text-primary border border-border rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Scale size={14} /> Compare
              </Link>
              <a
                href={directWebsiteUrl || cetPortalUrl || officialSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-electric-blue hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Globe size={14} />
                {directWebsiteUrl ? "Official Website" : "Official CET Profile"}
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-8 border-t border-border">
            <div>
              <div className="text-xs text-text-secondary">
                Branches Offered
              </div>
              <div className="text-xl font-bold text-primary mt-1">
                {college.branches?.length || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary">
                Seat Categories Reported
              </div>
              <div className="text-xl font-bold text-primary mt-1">
                {availableCategories.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary">Location</div>
              <div className="text-xl font-bold text-primary mt-1">
                {college.city}
              </div>
            </div>
            <div>
              <div className="text-xs text-text-secondary">
                Historical Data
              </div>
              <div className="text-xl font-bold text-success mt-1">
                2023 – 2025
              </div>
            </div>
          </div>
        </div>

        {/* Verified Placements, ROI & Official Fee Structure */}
        {college.has_verified_insights && college.placements && college.fees ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Placement Report Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <Briefcase size={12} /> Official Placement Report
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
                      Placements &amp; Career Outcomes
                    </h2>
                  </div>
                  {college.roi?.roi_tier && (
                    <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-[#0B1120] text-emerald-300">
                      {college.roi.roi_tier} ({college.roi.payback_years} yr payback)
                    </span>
                  )}
                </div>

                {/* 3 KPI Boxes */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      NIRF Median
                    </div>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-800 mt-1">
                      ₹{Number(college.placements.nirf_median_lpa).toFixed(2)}
                      <span className="text-xs font-semibold"> LPA</span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Avg. Package
                    </div>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                      {college.placements.average_lpa
                        ? `₹${Number(college.placements.average_lpa).toFixed(1)}`
                        : "N/A"}
                      {college.placements.average_lpa && (
                        <span className="text-xs font-semibold text-slate-500"> LPA</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-electric-blue">
                      Highest CTC
                    </div>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-electric-blue mt-1">
                      ₹{Number(college.placements.highest_lpa).toFixed(1)}
                      <span className="text-xs font-semibold"> LPA</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Placement Rate:{" "}
                    <strong className="text-slate-900">
                      {college.placements.placement_rate}
                    </strong>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {college.placements.report_cycle}
                  </span>
                </div>

                {college.placements.top_recruiters?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Notable Campus Recruiters
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {college.placements.top_recruiters.map((rec: string) => (
                        <span
                          key={rec}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-slate-700"
                        >
                          {rec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {college.placements.note && (
                  <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
                    <Info size={13} className="text-electric-blue shrink-0 mt-0.5" />
                    <span>{college.placements.note}</span>
                  </p>
                )}
              </div>

              {/* Authentic Source Bar */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-500 font-medium">
                  Source:{" "}
                  <strong className="text-slate-800">
                    {college.placements.source_label}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={college.placements.nirf_portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-electric-blue hover:underline"
                  >
                    NIRF Portal <ExternalLink size={10} />
                  </a>
                  {directWebsiteUrl && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a
                        href={directWebsiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-electric-blue hover:underline"
                      >
                        Institute T&amp;P Site <ExternalLink size={10} />
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Official Fee Structure Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      <IndianRupee size={12} /> Authentic Fee Structure
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 mt-1.5">
                      Annual B.E./B.Tech Fees &amp; Waivers
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                    {college.fees.institute_type}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      Annual Open / CAP Fee
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                      {college.fees.fee_range_label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {college.fees.academic_cycle}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Est. 4-Year Total (Open)
                    </div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-1">
                      ₹{(college.fees.four_year_estimate_inr / 100000).toFixed(2)} Lakh
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Excl. hostel &amp; university exam fees
                    </div>
                  </div>
                </div>

                {/* Maharashtra Category Concessions */}
                {Array.isArray(college.concessions) && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Maharashtra State Scholarships &amp; Fee Waivers
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {college.concessions.map((c: any) => (
                        <div
                          key={c.category}
                          className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-[11px]"
                        >
                          <div className="font-bold text-slate-900">{c.category}</div>
                          <div className="text-slate-600 mt-0.5 leading-snug">
                            {c.benefit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Authentic Source Bar */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-500 font-medium">
                  Source:{" "}
                  <strong className="text-slate-800">
                    {college.fees.source_label}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={college.fees.fra_portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-electric-blue hover:underline"
                  >
                    Maharashtra FRA <ExternalLink size={10} />
                  </a>
                  <span className="text-slate-300">•</span>
                  <a
                    href={college.fees.mahadbt_portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-electric-blue hover:underline"
                  >
                    MahaDBT <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-electric-blue bg-electric-blue/10 border border-electric-blue/20 px-2.5 py-0.5 rounded-full">
                <Building2 size={12} /> Official Placements &amp; Fee Sources
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Verify Approved Fees &amp; Placement Reports Directly
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                CAP Compass only publishes figures backed by verified NIRF / FRA
                filings. Check this institute&apos;s latest approved fee circular
                on Maharashtra FRA, NIRF submissions, and official college portal:
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              {directWebsiteUrl && (
                <a
                  href={directWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Globe size={13} /> Institute Website <ExternalLink size={11} />
                </a>
              )}
              <a
                href={college.official_sources?.fra_portal_url || "https://mahafra.org"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <IndianRupee size={13} /> Maharashtra FRA Fees <ExternalLink size={11} />
              </a>
              <a
                href={college.official_sources?.nirf_portal_url || "https://www.nirfindia.org"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Briefcase size={13} /> NIRF Reports <ExternalLink size={11} />
              </a>
              <a
                href={college.official_sources?.mahadbt_portal_url || "https://mahadbt.maharashtra.gov.in"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
              >
                MahaDBT Scholarships <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}

        {/* Two Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Offered Branches */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-xs">
              <h3 className="text-base font-bold text-primary flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <BookOpen size={18} className="text-electric-blue" /> Offered
                Engineering Branches
              </h3>
              <p className="text-xs text-text-secondary mb-3">
                Click any branch to filter the category rank & percentile table:
              </p>
              <div className="space-y-2">
                {college.branches?.map((b: string, i: number) => {
                  const isSelected = selectedBranch === b;
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setSelectedBranch(isSelected ? "" : b)}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-electric-blue text-white border-electric-blue"
                          : "bg-soft-bg border-border/60 text-primary hover:border-electric-blue/40"
                      }`}
                    >
                      <span>{b}</span>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? "bg-white" : "bg-electric-blue"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary to-navy-800 rounded-2xl p-6 text-white space-y-4 shadow-md">
              <Award size={28} className="text-teal-accent" />
              <h4 className="text-lg font-bold">
                Inspect Multi-Year Cutoff Trajectories
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                Analyze round-by-round percentile drops, category merit rank
                trends, and 2026 projected ranges for {college.college_name}.
              </p>
              <Link
                href={`/analytics?college=${college.college_code}${
                  selectedBranch
                    ? `&branch=${encodeURIComponent(selectedBranch)}`
                    : ""
                }${
                  selectedCategory
                    ? `&category=${encodeURIComponent(selectedCategory)}`
                    : ""
                }`}
                className="block text-center bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold py-3 rounded-xl transition-colors"
              >
                Run Cutoff Analytics
              </Link>
            </div>
          </div>

          {/* Right: Recent Cutoffs Table */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-3 border-b border-border">
                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                  <TrendingUp size={18} className="text-electric-blue" />{" "}
                  Category Rank & Percentile Cutoffs ({filteredCutoffs.length})
                </h3>
                <Link
                  href={`/analytics?college=${college.college_code}${
                    selectedBranch
                      ? `&branch=${encodeURIComponent(selectedBranch)}`
                      : ""
                  }${
                    selectedCategory
                      ? `&category=${encodeURIComponent(selectedCategory)}`
                      : ""
                  }`}
                  className="text-xs font-semibold text-electric-blue hover:underline"
                >
                  View Full Cutoff Analytics &rarr;
                </Link>
              </div>

              {/* Quick Category Filter Chips */}
              {quickChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mr-1">
                    Category:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedCategory === ""
                        ? "bg-electric-blue text-white border-electric-blue"
                        : "bg-soft-bg hover:bg-gray-200 text-primary border-border"
                    }`}
                  >
                    All
                  </button>
                  {quickChips.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? "" : cat)
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-electric-blue text-white border-electric-blue"
                          : "bg-soft-bg hover:bg-gray-200 text-primary border-border"
                      }`}
                      title={CATEGORY_LABELS[cat] || cat}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Filter Bar for Table */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 bg-soft-bg border border-border rounded-lg text-xs font-medium text-primary focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {college.branches?.map((b: string) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-soft-bg border border-border rounded-lg text-xs font-medium text-primary focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {formatCategory(c)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-2 bg-soft-bg border border-border rounded-lg text-xs font-medium text-primary focus:outline-none"
                >
                  <option value="">All Years (2023–2025)</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      CAP {y}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(e.target.value)}
                  className="px-3 py-2 bg-soft-bg border border-border rounded-lg text-xs font-medium text-primary focus:outline-none"
                >
                  <option value="">All Rounds (R1–R3)</option>
                  <option value="1">Round 1</option>
                  <option value="2">Round 2</option>
                  <option value="3">Round 3</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Year & Round</th>
                      <th className="py-3 px-4 text-right">
                        Category Percentile
                      </th>
                      <th className="py-3 px-4 text-right">
                        State Merit Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {(showAllRows
                      ? filteredCutoffs
                      : filteredCutoffs.slice(0, 30)
                    ).map((r: any, idx: number) => (
                      <tr
                        key={idx}
                        className="hover:bg-soft-bg/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-primary">
                          {r.branch_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="bg-soft-bg border border-border px-2 py-0.5 rounded font-mono font-bold text-[11px] w-fit text-primary">
                              {r.category}
                            </span>
                            {CATEGORY_LABELS[r.category] && (
                              <span className="text-[10px] text-text-secondary mt-0.5">
                                {CATEGORY_LABELS[r.category]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary font-medium">
                          {r.year} • Round {r.round_number}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-extrabold text-primary">
                          {r.percentile != null
                            ? `${Number(r.percentile).toFixed(2)} %ile`
                            : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-electric-blue">
                          {r.merit_rank != null
                            ? `#${Math.round(r.merit_rank).toLocaleString()}`
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredCutoffs.length > 30 && (
                <div className="mt-4 pt-3 border-t border-border text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllRows(!showAllRows)}
                    className="text-xs font-semibold text-electric-blue hover:underline cursor-pointer"
                  >
                    {showAllRows
                      ? "Show Fewer Rows"
                      : `Show All ${filteredCutoffs.length} Rows`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
