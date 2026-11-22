"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import {
  Compass,
  Menu,
  X,
  Bookmark,
  Info,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Crown,
  Sparkles,
  Smartphone,
  Search,
  Code2,
} from "lucide-react";
import UpgradeModal from "@/components/UpgradeModal";
import CommandPalette from "@/components/CommandPalette";
import {
  GPAY_NUMBER,
  PlanSession,
  clearStoredPlan,
  getStoredPlan,
  isProActive,
} from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface BookmarkedItem {
  key: string;
  college_code: string;
  college_name: string;
  city: string;
  branch: string;
  historical_percentile?: number;
  historical_rank?: number;
  prediction_category?: string;
}

export function getStoredBookmarks(): BookmarkedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("cap_compass_bookmarks");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredBookmarks(items: BookmarkedItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("cap_compass_bookmarks", JSON.stringify(items));
    window.dispatchEvent(new Event("cap_bookmarks_updated"));
  } catch {
    // ignore storage errors
  }
}

export default function NavigationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modalType, setModalType] = useState<
    null | "how-it-works" | "shortlist" | "terms" | "privacy" | "disclaimer"
  >(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<"pro" | "vip">("pro");
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const sync = () => setBookmarks(getStoredBookmarks());
    const syncPlan = () => setPlanSession(getStoredPlan());
    const onOpenUpgrade = (e: Event) => {
      const custom = e as CustomEvent<{ plan?: "pro" | "vip"; reason?: string }>;
      setUpgradePlan(custom.detail?.plan || "pro");
      setUpgradeReason(custom.detail?.reason);
      setUpgradeOpen(true);
    };
    sync();
    syncPlan();

    // Server-verify any stored Pro/VIP entitlement token (prevents localStorage paywall tampering)
    const verifyStoredEntitlement = async () => {
      const current = getStoredPlan();
      if (current.plan === "pro" || current.plan === "vip") {
        if (!current.entitlementToken || !current.entitlementToken.startsWith("v1.")) {
          clearStoredPlan();
          return;
        }
        try {
          const res = await axios.post(`${API_BASE}/payments/verify-token`, {
            entitlement_token: current.entitlementToken,
          });
          if (!res.data?.valid) {
            clearStoredPlan();
          }
        } catch {
          // If backend is temporarily offline, keep current signed session until next check
        }
      }
    };
    verifyStoredEntitlement();

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };

    window.addEventListener("cap_bookmarks_updated", sync);
    window.addEventListener("cap_plan_updated", syncPlan);
    window.addEventListener("cap_open_upgrade_modal", onOpenUpgrade);
    window.addEventListener("storage", sync);
    window.addEventListener("storage", syncPlan);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("cap_bookmarks_updated", sync);
      window.removeEventListener("cap_plan_updated", syncPlan);
      window.removeEventListener("cap_open_upgrade_modal", onOpenUpgrade);
      window.removeEventListener("storage", sync);
      window.removeEventListener("storage", syncPlan);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const removeBookmark = (key: string) => {
    const updated = bookmarks.filter((b) => b.key !== key);
    saveStoredBookmarks(updated);
  };

  const compareShortlisted = () => {
    const uniqueCodes = Array.from(
      new Set(bookmarks.map((b) => b.college_code))
    ).slice(0, 4);
    setModalType(null);
    if (uniqueCodes.length > 0) {
      router.push(`/compare?colleges=${uniqueCodes.join(",")}`);
    } else {
      router.push("/compare");
    }
  };

  const navItems = [
    { href: "/", label: "Predictor", match: (p: string) => p === "/" },
    {
      href: "/option-form",
      label: "Option Form",
      badge: "PRO",
      match: (p: string) => p.startsWith("/option-form"),
    },
    {
      href: "/betterment",
      label: "Betterment",
      badge: "PRO",
      match: (p: string) => p.startsWith("/betterment"),
    },
    {
      href: "/roi-finder",
      label: "ROI & Fees",
      badge: "NEW",
      match: (p: string) => p.startsWith("/roi-finder"),
    },
    {
      href: "/what-if",
      label: "What-If",
      match: (p: string) => p.startsWith("/what-if"),
    },
    {
      href: "/explorer",
      label: "Explorer",
      match: (p: string) => p.startsWith("/explorer") || p.startsWith("/college"),
    },
    {
      href: "/compare",
      label: "Compare",
      match: (p: string) => p.startsWith("/compare"),
    },
    {
      href: "/pricing",
      label: "Pricing",
      match: (p: string) => p.startsWith("/pricing"),
    },
  ];

  const proActive = isProActive(planSession);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.03)] z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center text-electric-blue transition-transform group-hover:rotate-45 duration-500">
              <Compass size={20} strokeWidth={2.4} />
            </div>
            <span className="font-extrabold tracking-tight text-base text-slate-900">
              CAP COMPASS
            </span>
          </Link>

          {/* Center: Navigation */}
          <nav className="hidden lg:flex items-center gap-1 font-medium text-[13px] text-slate-600 h-full">
            {navItems.map((item) => {
              const active = item.match(pathname || "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-electric-blue/10 text-electric-blue font-semibold after:content-[''] after:absolute after:-bottom-[13px] after:left-2.5 after:right-2.5 after:h-[2px] after:bg-electric-blue after:rounded-full"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <span>{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        item.badge === "NEW"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-electric-blue/15 text-electric-blue"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="hidden lg:flex items-center gap-2 text-sm font-medium shrink-0">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              title="Quick Search Colleges & Tools (Ctrl+K)"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 px-2.5 py-2 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-white shadow-2xs transition-all cursor-pointer"
            >
              <Search size={14} className="text-slate-500" />
              <kbd className="hidden xl:inline-flex items-center text-[10px] font-mono font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setModalType("shortlist")}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              <Bookmark
                size={15}
                className={
                  bookmarks.length > 0
                    ? "text-electric-blue fill-electric-blue"
                    : "text-slate-500"
                }
              />
              <span className="font-semibold text-xs">Shortlist</span>
              <span
                className={`font-mono tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                  bookmarks.length > 0
                    ? "bg-electric-blue text-white"
                    : "bg-slate-100 text-slate-500 border border-slate-200/70"
                }`}
              >
                {bookmarks.length}
              </span>
            </button>

            {proActive ? (
              <button
                type="button"
                onClick={() => setUpgradeOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <Crown size={14} className="text-emerald-600" />
                {planSession.plan === "vip" ? "VIP ACTIVE" : "PRO ACTIVE"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setUpgradePlan("pro");
                  setUpgradeReason(undefined);
                  setUpgradeOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-electric-blue to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                <Sparkles size={14} />
                Upgrade Pro • ₹199
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex lg:hidden items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Quick search"
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                proActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-electric-blue text-white"
              }`}
            >
              <Crown size={12} />
              {proActive ? planSession.plan.toUpperCase() : "Pro"}
            </button>
            <button
              type="button"
              onClick={() => setModalType("shortlist")}
              className="relative p-2 text-text-secondary hover:text-primary"
              aria-label="Open shortlist"
            >
              <Bookmark size={20} />
              {bookmarks.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-electric-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {bookmarks.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-primary rounded-lg hover:bg-soft-bg"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-b border-border px-6 py-4 space-y-2.5">
            {navItems.map((item) => {
              const active = item.match(pathname || "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between py-2 text-sm font-medium ${
                    active ? "text-electric-blue font-bold" : "text-primary"
                  }`}
                >
                  <span>{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-electric-blue/10 text-electric-blue">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/cap-guide"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-left py-2 text-sm font-medium text-primary"
            >
              CAP Guide &amp; Document Checklist
            </Link>
            <Link
              href="/analytics"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-left py-2 text-sm font-medium text-primary"
            >
              Cutoff Analytics
            </Link>
            <Link
              href="/rank-calculator"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-left py-2 text-sm font-medium text-primary"
            >
              Rank Calculator
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-left py-2 text-sm font-medium text-text-secondary"
            >
              About — Arsh Shaikh
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setModalType("how-it-works");
              }}
              className="block w-full text-left py-2 text-sm font-medium text-text-secondary"
            >
              How It Works
            </button>
            <div className="pt-2 border-t border-border flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setUpgradeOpen(true);
                }}
                className="w-full text-center bg-electric-blue text-white py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
              >
                {proActive
                  ? "Manage Pro Pass"
                  : `Unlock CAP Pro • ₹199 (GPay ${GPAY_NUMBER})`}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col pt-16 print:pt-0">{children}</main>

      <footer className="bg-white border-t border-slate-200/90 py-12 text-sm text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Compass size={24} className="text-electric-blue" />
              <span className="font-extrabold tracking-tight text-lg text-slate-900">
                CAP COMPASS
              </span>
            </div>
            <p className="max-w-sm leading-relaxed text-xs sm:text-sm">
              Navigate Maharashtra engineering admissions with dual rank &amp;
              percentile predictors, smart DTE option form generation, and
              historical cutoff analytics across 2023–2025 CAP Rounds 1–3.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
                <Smartphone size={14} className="text-electric-blue" />
                <span>Official GPay / WhatsApp:</span>
                <strong className="font-mono tabular-nums text-slate-900">
                  {GPAY_NUMBER}
                </strong>
              </div>
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                <Code2 size={13} className="text-blue-400" />
                <span>Made by Arsh Shaikh</span>
              </Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Platform</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link
                  href="/?start=1"
                  className="hover:text-electric-blue transition-colors"
                >
                  College Predictor
                </Link>
              </li>
              <li>
                <Link
                  href="/option-form"
                  className="hover:text-electric-blue transition-colors"
                >
                  Smart CAP Option Form
                </Link>
              </li>
              <li>
                <Link
                  href="/betterment"
                  className="hover:text-electric-blue transition-colors"
                >
                  Betterment &amp; Spot-Round Radar
                </Link>
              </li>
              <li>
                <Link
                  href="/roi-finder"
                  className="hover:text-electric-blue transition-colors"
                >
                  Scholarship &amp; ROI Fee Finder
                </Link>
              </li>
              <li>
                <Link
                  href="/what-if"
                  className="hover:text-electric-blue transition-colors"
                >
                  What-If Score Simulator
                </Link>
              </li>
              <li>
                <Link
                  href="/cap-guide"
                  className="hover:text-electric-blue transition-colors"
                >
                  CAP Guide &amp; Document Checklist
                </Link>
              </li>
              <li>
                <Link
                  href="/rank-calculator"
                  className="hover:text-electric-blue transition-colors"
                >
                  Percentile ↔ Rank Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/explorer"
                  className="hover:text-electric-blue transition-colors"
                >
                  College Explorer
                </Link>
              </li>
              <li>
                <Link
                  href="/compare"
                  className="hover:text-electric-blue transition-colors"
                >
                  Side-by-Side Compare
                </Link>
              </li>
              <li>
                <Link
                  href="/analytics"
                  className="hover:text-electric-blue transition-colors"
                >
                  Cutoff Analytics
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">
              Plans &amp; Legal
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-electric-blue transition-colors font-semibold text-electric-blue"
                >
                  Pricing &amp; CAP Pro Pass (₹199)
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-electric-blue transition-colors"
                >
                  About — Arsh Shaikh
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType("how-it-works")}
                  className="hover:text-electric-blue transition-colors cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType("terms")}
                  className="hover:text-electric-blue transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType("privacy")}
                  className="hover:text-electric-blue transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setModalType("disclaimer")}
                  className="hover:text-electric-blue transition-colors cursor-pointer"
                >
                  Disclaimer
                </button>
              </li>
              <li className="pt-2 border-t border-slate-100">
                <Link
                  href="/admin"
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Owner Revenue Dashboard &rarr;
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs sm:text-sm">
            &copy; {new Date().getFullYear()} CAP Compass. Designed &amp; Developed by{" "}
            <Link
              href="/about"
              className="font-bold text-slate-900 hover:text-electric-blue transition-colors"
            >
              Arsh Shaikh
            </Link>
            . All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Decision-support tool based on historical DTE/CET Cell CAP cutoffs.
            Not an official counselling portal.
          </p>
        </div>
      </footer>

      {/* Modals */}
      {modalType && (
        <div
          className="fixed inset-0 bg-navy-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="bg-white rounded-2xl border border-border shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                {modalType === "shortlist" ? (
                  <Bookmark className="text-electric-blue" size={22} />
                ) : modalType === "disclaimer" ? (
                  <ShieldAlert className="text-warning" size={22} />
                ) : (
                  <Info className="text-electric-blue" size={22} />
                )}
                <h3 className="text-xl font-bold text-primary">
                  {modalType === "how-it-works" && "How CAP Compass Works"}
                  {modalType === "shortlist" &&
                    `Saved Option Shortlist (${bookmarks.length})`}
                  {modalType === "terms" && "Terms of Service"}
                  {modalType === "privacy" && "Privacy Policy"}
                  {modalType === "disclaimer" &&
                    "Official CAP Counselling Disclaimer"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-soft-bg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {modalType === "how-it-works" && (
              <div className="space-y-5 text-sm text-text-secondary leading-relaxed">
                <p>
                  <strong className="text-primary">CAP Compass 2.0</strong> is an
                  engineering admission decision-support platform built on{" "}
                  <strong className="text-primary">
                    79,600+ official MHT-CET CAP cutoff records
                  </strong>{" "}
                  spanning academic years 2023, 2024, and 2025 across CAP Rounds
                  1, 2, and 3.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-soft-bg border border-border">
                    <div className="font-bold text-primary mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-success" /> 1.
                      Smart Category Fallback
                    </div>
                    <p className="text-xs">
                      When an institute only publishes State-Level seats under
                      TFWS, EWS, LOPENS, or Open, CAP Compass calibrates an
                      estimated cutoff for your category and clearly marks it
                      with an <code>*Est</code> badge.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-soft-bg border border-border">
                    <div className="font-bold text-primary mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-electric-blue" />{" "}
                      2. Three-Band Classification
                    </div>
                    <p className="text-xs">
                      Every course is classified into{" "}
                      <strong>Historically Within Range</strong>,{" "}
                      <strong>Moderate</strong> (within 3%ile / 25% rank), or{" "}
                      <strong>Ambitious</strong> (within 8%ile / 60% rank).
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-soft-bg border border-border">
                    <div className="font-bold text-primary mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-teal-accent" /> 3.
                      Multi-Year Trend Analytics
                    </div>
                    <p className="text-xs">
                      Inspect round-by-round percentile & merit rank trajectories,
                      YoY shifts, and 2026 projected ranges on the Cutoff
                      Analytics page.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-soft-bg border border-border">
                    <div className="font-bold text-primary mb-1 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-primary" /> 4.
                      Shortlist & Side-by-Side Compare
                    </div>
                    <p className="text-xs">
                      Bookmark your favorite college-branch options and compare
                      up to 4 institutes side-by-side or export your list as PDF/CSV.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <Link
                    href="/?start=1"
                    onClick={() => setModalType(null)}
                    className="bg-electric-blue hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
                  >
                    Launch Predictor <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            )}

            {modalType === "shortlist" && (
              <div className="space-y-4">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-10 text-text-secondary">
                    <Bookmark
                      size={36}
                      className="mx-auto mb-3 text-text-secondary/40"
                    />
                    <p className="font-medium text-primary mb-1">
                      Your shortlist is empty
                    </p>
                    <p className="text-xs mb-5">
                      Click the bookmark icon on any college in the Predictor or
                      Explorer to save options for CAP choice filling.
                    </p>
                    <Link
                      href="/?start=1"
                      onClick={() => setModalType(null)}
                      className="bg-electric-blue text-white text-xs font-semibold px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5"
                    >
                      Find Colleges <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {bookmarks.map((b, idx) => (
                        <div
                          key={b.key}
                          className="p-3.5 rounded-xl border border-border bg-soft-bg/60 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-text-secondary mb-0.5">
                              <span className="font-mono font-bold text-primary">
                                #{idx + 1} • DTE {b.college_code}
                              </span>
                              <span>•</span>
                              <span>{b.city}</span>
                            </div>
                            <Link
                              href={`/college/${b.college_code}`}
                              onClick={() => setModalType(null)}
                              className="font-bold text-sm text-primary hover:text-electric-blue block truncate"
                            >
                              {b.college_name}
                            </Link>
                            <div className="text-xs font-medium text-electric-blue">
                              {b.branch}
                              {b.historical_percentile != null && (
                                <span className="text-text-secondary ml-2 font-mono">
                                  ({b.historical_percentile.toFixed(2)}%ile)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBookmark(b.key)}
                            className="p-2 text-text-secondary hover:text-danger rounded-lg hover:bg-white cursor-pointer"
                            title="Remove from shortlist"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-border flex flex-wrap justify-between items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveStoredBookmarks([])}
                        className="text-xs text-danger hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={compareShortlisted}
                          className="bg-electric-blue hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                        >
                          Compare Top {Math.min(4, new Set(bookmarks.map((b) => b.college_code)).size)} Colleges
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {modalType === "terms" && (
              <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
                <p>
                  CAP Compass is provided as an educational and informational
                  decision-support utility for engineering aspirants in
                  Maharashtra.
                </p>
                <p>
                  By using this platform, you acknowledge that all historical
                  cutoffs, calibrated category estimates, and trend projections
                  are derived from past CAP rounds (2023–2025) and do not
                  guarantee future seat allotment in official State CET Cell
                  counselling.
                </p>
              </div>
            )}

            {modalType === "privacy" && (
              <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
                <p>
                  CAP Compass respects your privacy. Your exam scores,
                  percentiles, merit ranks, and shortlisted colleges are stored
                  locally in your browser (<code>localStorage</code>) and are
                  only sent to the local/configured API server to compute cutoff
                  recommendations.
                </p>
                <p>
                  We do not sell or share personal student data with third-party
                  marketers or admission agents.
                </p>
              </div>
            )}

            {modalType === "disclaimer" && (
              <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
                <p className="font-semibold text-primary">
                  Important Notice Regarding MHT-CET CAP Counselling:
                </p>
                <p>
                  1. CAP Compass is an independent analytics tool and is{" "}
                  <strong>not affiliated with</strong> the State Common Entrance
                  Test Cell, Maharashtra or the Directorate of Technical
                  Education (DTE).
                </p>
                <p>
                  2. Predictions labeled <em>Historically Within Range</em>,{" "}
                  <em>Moderate</em>, or <em>Ambitious</em> reflect historical
                  cutoff margins, not guaranteed admission probabilities. Actual
                  cutoffs depend on seat matrix changes, candidate pool size,
                  and option form preferences in the live counselling year.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        initialPlan={upgradePlan}
        reason={upgradeReason}
      />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

