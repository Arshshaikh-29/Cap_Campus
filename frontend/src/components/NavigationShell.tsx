"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import axios from "axios";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  BookOpenCheck,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Compass,
  CreditCard,
  GitCompare,
  Info,
  LayoutGrid,
  ListOrdered,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import UpgradeModal from "@/components/UpgradeModal";
import CommandPalette from "@/components/CommandPalette";
import { showToast } from "@/components/ui/ToastProvider";
import {
  GPAY_NUMBER,
  PlanSession,
  clearStoredPlan,
  getStoredPlan,
  isProActive,
  saveStoredPlan,
} from "@/lib/plan";
import {
  AuthSession,
  clearStoredAuth,
  getStoredAuth,
  logoutFromServer,
  saveStoredAuth,
  syncProfileToCloud,
} from "@/lib/auth";

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

let _bookmarkSyncTimer: ReturnType<typeof setTimeout> | null = null;

export function saveStoredBookmarks(items: BookmarkedItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("cap_compass_bookmarks", JSON.stringify(items));
    window.dispatchEvent(new Event("cap_bookmarks_updated"));

    if (getStoredAuth()?.token) {
      if (_bookmarkSyncTimer) clearTimeout(_bookmarkSyncTimer);
      _bookmarkSyncTimer = setTimeout(() => {
        syncProfileToCloud({ bookmarks: items }).catch(() => undefined);
      }, 650);
    }
  } catch {
    // ignore storage errors
  }
}

interface NavItem {
  href: string;
  label: string;
  desc?: string;
  badge?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match: (p: string) => boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Admission Tools",
    items: [
      {
        href: "/",
        label: "College Predictor",
        desc: "2023–2026 rank & %ile match",
        icon: Compass,
        match: (p) => p === "/",
      },
      {
        href: "/option-form",
        label: "Option Form",
        desc: "Dream → Target → Safe list",
        badge: "PRO",
        icon: ListOrdered,
        match: (p) => p.startsWith("/option-form"),
      },
      {
        href: "/betterment",
        label: "Betterment Radar",
        desc: "R1 → R4 cutoff drops",
        badge: "PRO",
        icon: Radar,
        match: (p) => p.startsWith("/betterment"),
      },
      {
        href: "/roi-finder",
        label: "ROI & Net Fees",
        desc: "MahaDBT waivers & payback",
        icon: Wallet,
        match: (p) => p.startsWith("/roi-finder"),
      },
      {
        href: "/what-if",
        label: "What-If Simulator",
        desc: "Test ±2 %ile score shifts",
        icon: Activity,
        match: (p) => p.startsWith("/what-if"),
      },
    ],
  },
  {
    title: "Explore & Analytics",
    items: [
      {
        href: "/map",
        label: "College Map",
        desc: "400 interactive campuses",
        icon: MapPin,
        match: (p) => p.startsWith("/map"),
      },
      {
        href: "/explorer",
        label: "College Explorer",
        desc: "400 verified DTE institutes",
        icon: Building2,
        match: (p) => p.startsWith("/explorer") || p.startsWith("/college"),
      },
      {
        href: "/compare",
        label: "Compare Colleges",
        desc: "Side-by-side up to 4",
        icon: GitCompare,
        match: (p) => p.startsWith("/compare"),
      },
      {
        href: "/analytics",
        label: "Cutoff Analytics",
        desc: "Multi-year trend charts",
        icon: BarChart3,
        match: (p) => p.startsWith("/analytics"),
      },
      {
        href: "/rank-calculator",
        label: "Rank Calculator",
        desc: "Marks & %ile ↔ Rank",
        icon: Calculator,
        match: (p) => p.startsWith("/rank-calculator"),
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        href: "/cap-guide",
        label: "CAP Guide",
        desc: "Documents & CAP steps",
        icon: BookOpenCheck,
        match: (p) => p.startsWith("/cap-guide"),
      },
      {
        href: "/pricing",
        label: "Plans & Pricing",
        desc: "CAP Pro & VIP passes",
        icon: CreditCard,
        match: (p) => p.startsWith("/pricing"),
      },
      {
        href: "/about",
        label: "About Platform",
        desc: "Creator & WhatsApp desk",
        icon: Info,
        match: (p) => p.startsWith("/about"),
      },
    ],
  },
];

function getBreadcrumbLabel(pathname: string): { section: string; page: string } {
  if (!pathname || pathname === "/") return { section: "Admission Tools", page: "College Predictor" };
  if (pathname.startsWith("/option-form")) return { section: "Admission Tools", page: "Smart Option Form" };
  if (pathname.startsWith("/betterment")) return { section: "Admission Tools", page: "Betterment Radar" };
  if (pathname.startsWith("/roi-finder")) return { section: "Admission Tools", page: "Scholarship & ROI Finder" };
  if (pathname.startsWith("/what-if")) return { section: "Admission Tools", page: "What-If Simulator" };
  if (pathname.startsWith("/map")) return { section: "Explore & Analytics", page: "Interactive College Map" };
  if (pathname.startsWith("/explorer")) return { section: "Explore & Analytics", page: "College Explorer" };
  if (pathname.startsWith("/college/")) {
    const code = pathname.split("/")[2] || "";
    return { section: "College Explorer", page: `Institute DTE ${code}` };
  }
  if (pathname.startsWith("/compare")) return { section: "Explore & Analytics", page: "Compare Colleges" };
  if (pathname.startsWith("/analytics")) return { section: "Explore & Analytics", page: "Cutoff Analytics" };
  if (pathname.startsWith("/rank-calculator")) return { section: "Explore & Analytics", page: "Rank Calculator" };
  if (pathname.startsWith("/cap-guide")) return { section: "Resources", page: "CAP Guide & Checklist" };
  if (pathname.startsWith("/pricing")) return { section: "Resources", page: "Plans & Pricing" };
  if (pathname.startsWith("/about")) return { section: "Resources", page: "About CAP Compass" };
  if (pathname.startsWith("/login")) return { section: "Account", page: "Student Portal" };
  if (pathname.startsWith("/admin")) return { section: "Administration", page: "Executive & Security Console" };
  return { section: "Workspace", page: "CAP Compass" };
}

export default function NavigationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [modalType, setModalType] = useState<
    null | "how-it-works" | "shortlist" | "terms" | "privacy" | "disclaimer"
  >(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<"pro" | "vip">("pro");
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const savedCollapse = window.localStorage.getItem("cap_sidebar_collapsed");
      if (savedCollapse === "1") setSidebarCollapsed(true);
    } catch {
      // ignore
    }

    const sync = () => setBookmarks(getStoredBookmarks());
    const syncPlan = () => setPlanSession(getStoredPlan());
    const syncAuth = () => setAuthSession(getStoredAuth());
    const onOpenUpgrade = (e: Event) => {
      const custom = e as CustomEvent<{ plan?: "pro" | "vip"; reason?: string }>;
      setUpgradePlan(custom.detail?.plan || "pro");
      setUpgradeReason(custom.detail?.reason);
      setUpgradeOpen(true);
    };
    sync();
    syncPlan();
    syncAuth();

    const verifyStoredGoogleSession = async () => {
      const curAuth = getStoredAuth();
      if (!curAuth?.token) return;
      try {
        const res = await axios.get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${curAuth.token}` },
        });
        if (res.data?.user) {
          saveStoredAuth({ token: curAuth.token, user: res.data.user });
        }
        if (res.data?.entitlement?.entitlement_token) {
          const ent = res.data.entitlement;
          saveStoredPlan({
            plan: ent.plan,
            accessKey: ent.access_key,
            entitlementToken: ent.entitlement_token,
            fullName: ent.full_name,
            status: "approved",
            utrNumber: ent.utr_number,
          });
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          clearStoredAuth();
        }
      }
    };
    verifyStoredGoogleSession();

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
          // keep current signed session if backend temporarily unavailable
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
    window.addEventListener("cap_auth_updated", syncAuth);
    window.addEventListener("cap_open_upgrade_modal", onOpenUpgrade);
    window.addEventListener("storage", sync);
    window.addEventListener("storage", syncPlan);
    window.addEventListener("storage", syncAuth);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("cap_bookmarks_updated", sync);
      window.removeEventListener("cap_plan_updated", syncPlan);
      window.removeEventListener("cap_auth_updated", syncAuth);
      window.removeEventListener("cap_open_upgrade_modal", onOpenUpgrade);
      window.removeEventListener("storage", sync);
      window.removeEventListener("storage", syncPlan);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("cap_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const removeBookmark = (key: string) => {
    const updated = bookmarks.filter((b) => b.key !== key);
    saveStoredBookmarks(updated);
    showToast("Removed from shortlist", "info");
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

  const handleQuickSignOut = async () => {
    setProfileOpen(false);
    await logoutFromServer();
    showToast("Signed out safely", "success", "Your session token was revoked on the server.");
  };

  const proActive = isProActive(planSession);
  const userRole = authSession?.user?.role || "student";
  const isStaffAdmin = userRole === "admin" || userRole === "super_admin";
  const crumb = getBreadcrumbLabel(pathname);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] flex">
      {/* ENTERPRISE DESKTOP SIDEBAR (lg: >= 1024px) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-white border-r border-[#E2E8F0] transition-[width] duration-200 ease-out print:hidden ${
          sidebarCollapsed ? "w-[72px]" : "w-[252px]"
        }`}
      >
        {/* Sidebar Header + Brand Logo */}
        <div
          className={`h-14 border-b border-[#E2E8F0] flex items-center shrink-0 ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <Link
            href="/"
            className="flex items-center min-w-0 focus:outline-none"
            aria-label="CAP Compass Home"
          >
            <BrandLogo
              variant={sidebarCollapsed ? "icon" : "compact"}
              theme="light"
              size="sm"
            />
          </Link>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {sidebarCollapsed && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="p-2 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF] transition-colors cursor-pointer"
              >
                <PanelLeftOpen size={17} />
              </button>
            </div>
          )}

          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`group flex items-center rounded-xl transition-all ${
                      sidebarCollapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-2.5 py-2 gap-2.5"
                    } ${
                      active
                        ? "bg-[#EEF2FF] text-[#4F46E5] font-semibold"
                        : "text-[#1E293B] hover:bg-[#F8FAFC] hover:text-[#172554] font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={17}
                        className={`shrink-0 transition-colors ${
                          active
                            ? "text-[#4F46E5]"
                            : "text-[#64748B] group-hover:text-[#172554]"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="text-[13px] truncate">{item.label}</span>
                      )}
                    </span>
                    {!sidebarCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          active
                            ? "bg-[#4F46E5] text-white"
                            : "bg-[#EEF2FF] text-[#4F46E5]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Role-Based Administration Section (Prominently visible to admin / super_admin) */}
          {isStaffAdmin && (
            <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">
                  Administration
                </div>
              )}
              <Link
                href="/admin"
                title={sidebarCollapsed ? "Admin & Security Console" : undefined}
                className={`flex items-center rounded-xl transition-all ${
                  sidebarCollapsed
                    ? "justify-center p-2.5"
                    : "justify-between px-2.5 py-2 gap-2.5"
                } ${
                  pathname.startsWith("/admin")
                    ? "bg-[#172554] text-white font-semibold"
                    : "bg-[#EEF2FF]/70 text-[#172554] hover:bg-[#EEF2FF] font-semibold"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck size={17} className="shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-[13px] truncate">Admin Console</span>
                  )}
                </span>
                {!sidebarCollapsed && (
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md ${
                      pathname.startsWith("/admin")
                        ? "bg-[#4F46E5] text-white"
                        : "bg-[#172554] text-white"
                    }`}
                  >
                    {userRole === "super_admin" ? "SUPER" : "ADMIN"}
                  </span>
                )}
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom Sidebar Plan Card */}
        <div className="p-3 border-t border-[#E2E8F0] shrink-0">
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => {
                setUpgradePlan("pro");
                setUpgradeReason(undefined);
                setUpgradeOpen(true);
              }}
              title={proActive ? `${planSession.plan.toUpperCase()} Pass Active` : "Upgrade to CAP Pro"}
              className={`w-full p-2.5 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                proActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-[#4F46E5] hover:bg-[#4338CA] text-white"
              }`}
            >
              <Sparkles size={16} />
            </button>
          ) : proActive ? (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="w-full p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">
                  {planSession.plan === "vip" ? "VIP Pass Active" : "CAP Pro Active"}
                </span>
                <CheckCircle2 size={14} className="text-emerald-600" />
              </div>
              <div className="text-[11px] text-emerald-700/80 mt-0.5">
                Full 2026 CAP Season unlocked
              </div>
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#EEF2FF] border border-[#4F46E5]/15 space-y-2.5">
              <div>
                <div className="text-xs font-bold text-[#172554]">
                  CAP Compass Pro
                </div>
                <div className="text-[11px] text-[#64748B] leading-snug mt-0.5">
                  Unlock 60-choice Option Forms, Betterment Radar &amp; CSV export.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUpgradePlan("pro");
                  setUpgradeReason(undefined);
                  setUpgradeOpen(true);
                }}
                className="w-full py-2 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Sparkles size={13} /> Unlock Pro • ₹199
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT WORKSPACE COLUMN */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-[padding-left] duration-200 ease-out print:pl-0 ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[252px]"
        }`}
      >
        {/* TOP WORKSPACE HEADER */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3 sm:px-5 flex items-center justify-between gap-3 print:hidden">
          {/* Left: Mobile Logo + Drawer OR Desktop Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/" className="lg:hidden flex items-center shrink-0">
              <BrandLogo variant="compact" theme="light" size="sm" />
            </Link>

            {/* Desktop Breadcrumbs */}
            <nav
              aria-label="Breadcrumb"
              className="hidden lg:flex items-center gap-1.5 text-xs min-w-0"
            >
              <span className="text-[#64748B] font-medium whitespace-nowrap">
                {crumb.section}
              </span>
              <ChevronRight size={13} className="text-[#CBD5E1] shrink-0" />
              <span className="text-[#172554] font-semibold truncate">
                {crumb.page}
              </span>
            </nav>
          </div>

          {/* Right: Global Search, Shortlist, Notifications & Profile Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Global Command Search Trigger */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              title="Quick Search Colleges & Tools (Ctrl+K)"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#CBD5E1] text-[#64748B] hover:text-[#172554] transition-all cursor-pointer"
            >
              <Search size={14} className="text-[#4F46E5] shrink-0" />
              <span className="hidden md:inline text-xs font-medium pr-3">
                Search colleges or tools...
              </span>
              <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono font-semibold text-[#64748B] bg-white px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                Ctrl K
              </kbd>
            </button>

            {/* Shortlist Button */}
            <button
              type="button"
              onClick={() => setModalType("shortlist")}
              title="Saved Option Shortlist"
              aria-label="Open saved shortlist"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#1E293B] transition-colors cursor-pointer"
            >
              <Bookmark
                size={15}
                className={
                  bookmarks.length > 0
                    ? "text-[#4F46E5] fill-[#4F46E5]"
                    : "text-[#64748B]"
                }
              />
              <span className="hidden xl:inline text-xs font-semibold">
                Shortlist
              </span>
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-md ${
                  bookmarks.length > 0
                    ? "bg-[#4F46E5] text-white"
                    : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {bookmarks.length}
              </span>
            </button>

            {/* Notifications Dropdown (Real System Status Only) */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((p) => !p);
                  setProfileOpen(false);
                }}
                aria-label="Workspace notifications"
                className="relative p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] transition-colors cursor-pointer"
              >
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
              </button>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="animate-fade-in absolute right-0 top-11 w-80 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-3 z-50 space-y-2">
                    <div className="px-2 py-1 flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <span className="text-xs font-bold text-[#172554]">
                        Workspace Status
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                        LIVE DATA
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]/80">
                        <div className="font-semibold text-[#172554]">
                          2023–2026 CAP Rounds 1–4 Active
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          198,336 verified cutoff records across 400 Maharashtra colleges.
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]/80">
                        <div className="font-semibold text-[#172554]">
                          {authSession
                            ? `Cloud Sync Active (${authSession.user.email})`
                            : "Sign in to Cloud-Sync Shortlist"}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          {bookmarks.length} shortlisted college(s) • Plan:{" "}
                          <strong className="uppercase text-[#4F46E5]">
                            {planSession.plan}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Menu / Sign In */}
            {authSession ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((p) => !p);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  {authSession.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={authSession.user.avatar_url}
                      alt={authSession.user.full_name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-lg bg-[#172554] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {authSession.user.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden sm:inline text-xs font-semibold text-[#172554] max-w-[84px] truncate">
                    {authSession.user.full_name.split(" ")[0]}
                  </span>
                  <ChevronDown size={13} className="text-[#64748B] hidden sm:inline" />
                </button>

                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div className="animate-fade-in absolute right-0 top-11 w-64 bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-2 z-50 space-y-1">
                      <div className="px-3 py-2.5 border-b border-[#E2E8F0]">
                        <div className="text-xs font-bold text-[#172554] truncate">
                          {authSession.user.full_name}
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B] truncate">
                          {authSession.user.email}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                            {userRole}
                          </span>
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                            {planSession.plan}
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/login"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC]"
                      >
                        <User size={14} className="text-[#64748B]" /> My Student Portal
                      </Link>
                      {isStaffAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF]/60 hover:bg-[#EEF2FF]"
                        >
                          <ShieldCheck size={14} /> Executive Admin Console
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setUpgradeOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#1E293B] hover:bg-[#F8FAFC] cursor-pointer text-left"
                      >
                        <Sparkles size={14} className="text-[#4F46E5]" />
                        {proActive ? "Manage Pro Pass" : "Upgrade to CAP Pro"}
                      </button>
                      <div className="pt-1 border-t border-[#E2E8F0]">
                        <button
                          type="button"
                          onClick={handleQuickSignOut}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer text-left"
                        >
                          <LogOut size={14} /> Sign Out &amp; Revoke Session
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* MOBILE & TABLET SLIDE-OVER NAVIGATION DRAWER (< 1024px) */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-[#172554]/45 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <div className="animate-fade-in relative z-10 w-[86vw] max-w-sm bg-white h-full border-r border-[#E2E8F0] shadow-2xl flex flex-col">
              <div className="h-14 px-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
                <BrandLogo variant="compact" theme="light" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-1.5">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      {group.title}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = item.match(pathname);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                              active
                                ? "bg-[#EEF2FF] text-[#4F46E5] font-semibold"
                                : "text-[#1E293B] hover:bg-[#F8FAFC]"
                            }`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <Icon
                                size={17}
                                className={
                                  active ? "text-[#4F46E5]" : "text-[#64748B]"
                                }
                              />
                              <span className="min-w-0">
                                <span className="block text-sm leading-tight">
                                  {item.label}
                                </span>
                                {item.desc && (
                                  <span className="block text-[11px] text-[#64748B] font-normal">
                                    {item.desc}
                                  </span>
                                )}
                              </span>
                            </span>
                            {item.badge && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {isStaffAdmin && (
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#172554] text-white text-sm font-semibold"
                    >
                      <span className="flex items-center gap-2.5">
                        <ShieldCheck size={17} /> Admin &amp; Security Console
                      </span>
                      <span className="text-[10px] font-mono uppercase bg-[#4F46E5] px-2 py-0.5 rounded">
                        {userRole}
                      </span>
                    </Link>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#E2E8F0] space-y-2 shrink-0 bg-[#F8FAFC]">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center py-2.5 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#172554]"
                >
                  {authSession
                    ? `Signed in: ${authSession.user.full_name}`
                    : "Sign In with Google"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setUpgradeOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold cursor-pointer"
                >
                  {proActive ? "Manage Pro Pass" : "Unlock CAP Pro • ₹199"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN PAGE CONTENT */}
        <main className="flex-1 flex flex-col min-w-0">{children}</main>

        {/* ENTERPRISE FOOTER */}
        <footer className="bg-white border-t border-[#E2E8F0] pt-10 pb-24 md:pb-10 text-sm text-[#64748B] print:hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2 space-y-4">
              <BrandLogo variant="primary" theme="light" size="md" showTagline />
              <p className="max-w-sm leading-relaxed text-xs sm:text-sm text-[#64748B]">
                Enterprise-grade Maharashtra engineering admission intelligence
                spanning 198,336 verified 2023–2026 CAP Rounds 1–4 cutoffs across
                400 DTE colleges.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                  <Smartphone size={14} className="text-[#4F46E5]" />
                  <span>GPay / WhatsApp:</span>
                  <strong className="font-mono tabular-nums text-[#172554]">
                    {GPAY_NUMBER}
                  </strong>
                </div>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-semibold transition-colors"
                >
                  <Code2 size={13} className="text-[#C7D2FE]" />
                  <span>Built by Arsh Shaikh</span>
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#172554] text-xs uppercase tracking-wider mb-3.5">
                Platform
              </h4>
              <ul className="space-y-2 text-xs">
                {[
                  { href: "/?start=1", label: "College Predictor" },
                  { href: "/option-form", label: "Smart CAP Option Form" },
                  { href: "/betterment", label: "Betterment & Spot Radar" },
                  { href: "/roi-finder", label: "Scholarship & ROI Finder" },
                  { href: "/map", label: "Interactive College Map" },
                  { href: "/explorer", label: "College Explorer (400)" },
                  { href: "/compare", label: "Side-by-Side Compare" },
                  { href: "/analytics", label: "Multi-Year Analytics" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-[#4F46E5] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-[#172554] text-xs uppercase tracking-wider mb-3.5">
                Governance &amp; Account
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link
                    href="/login"
                    className="hover:text-[#4F46E5] font-semibold text-[#172554] transition-colors"
                  >
                    Student Login Portal
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="hover:text-[#4F46E5] font-semibold text-[#4F46E5] transition-colors"
                  >
                    Plans &amp; CAP Pro Pass
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalType("how-it-works")}
                    className="hover:text-[#4F46E5] transition-colors cursor-pointer"
                  >
                    Methodology
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalType("terms")}
                    className="hover:text-[#4F46E5] transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalType("privacy")}
                    className="hover:text-[#4F46E5] transition-colors cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalType("disclaimer")}
                    className="hover:text-[#4F46E5] transition-colors cursor-pointer"
                  >
                    Official Disclaimer
                  </button>
                </li>
                <li className="pt-2 border-t border-[#E2E8F0]">
                  <Link
                    href="/admin"
                    className="text-[11px] text-[#64748B] hover:text-[#172554] transition-colors"
                  >
                    Admin &amp; Security Console &rarr;
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-5 sm:px-6 mt-10 pt-6 border-t border-[#E2E8F0] flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs">
              &copy; {new Date().getFullYear()} CAP Compass. Engineered by{" "}
              <Link
                href="/about"
                className="font-semibold text-[#172554] hover:text-[#4F46E5]"
              >
                Arsh Shaikh
              </Link>
              . All rights reserved.
            </p>
            <p className="text-[11px] text-[#64748B]">
              Decision-support analytics based on historical DTE/CET Cell CAP
              cutoffs. Not an official government portal.
            </p>
          </div>
        </footer>
      </div>

      {/* INFO & SHORTLIST MODALS */}
      {modalType && (
        <div
          className="fixed inset-0 bg-[#172554]/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalType(null)}
        >
          <div
            className="animate-fade-in bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                {modalType === "shortlist" ? (
                  <Bookmark className="text-[#4F46E5]" size={20} />
                ) : modalType === "disclaimer" ? (
                  <ShieldAlert className="text-orange-600" size={20} />
                ) : (
                  <Info className="text-[#4F46E5]" size={20} />
                )}
                <h3 className="text-lg font-bold text-[#172554]">
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
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {modalType === "how-it-works" && (
              <div className="space-y-5 text-sm text-[#64748B] leading-relaxed">
                <p>
                  <strong className="text-[#172554]">CAP Compass</strong> is an
                  engineering admission decision-support platform built on{" "}
                  <strong className="text-[#172554]">
                    198,336 official MHT-CET CAP cutoff records
                  </strong>{" "}
                  spanning 2023–2026 across CAP Rounds 1, 2, 3, and 4.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="font-bold text-[#172554] mb-1 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 size={15} className="text-emerald-600" /> 1.
                      Smart Category Calibration
                    </div>
                    <p className="text-xs">
                      When an institute only publishes State-Level seats, CAP
                      Compass calibrates an estimated cutoff for your quota and
                      transparently marks it with an <code>*Est</code> tag.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="font-bold text-[#172554] mb-1 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 size={15} className="text-[#4F46E5]" /> 2.
                      Three-Band Classification
                    </div>
                    <p className="text-xs">
                      Every course is classified into{" "}
                      <strong>Historically Within Range</strong>,{" "}
                      <strong>Moderate</strong>, or <strong>Ambitious</strong>{" "}
                      using verified rank-scale calibration.
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <Link
                    href="/?start=1"
                    onClick={() => setModalType(null)}
                    className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
                  >
                    Launch Predictor <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}

            {modalType === "shortlist" && (
              <div className="space-y-4">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-10 text-[#64748B]">
                    <Bookmark
                      size={32}
                      className="mx-auto mb-3 text-[#CBD5E1]"
                    />
                    <p className="font-semibold text-[#172554] mb-1">
                      Your shortlist is empty
                    </p>
                    <p className="text-xs mb-5">
                      Bookmark colleges in the Predictor, Map, or Explorer to
                      compare and build your CAP Option Form.
                    </p>
                    <Link
                      href="/?start=1"
                      onClick={() => setModalType(null)}
                      className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5"
                    >
                      Find Colleges <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {bookmarks.map((b, idx) => (
                        <div
                          key={b.key}
                          className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-0.5">
                              <span className="font-mono font-bold text-[#172554]">
                                #{idx + 1} • DTE {b.college_code}
                              </span>
                              <span>•</span>
                              <span>{b.city}</span>
                            </div>
                            <Link
                              href={`/college/${b.college_code}`}
                              onClick={() => setModalType(null)}
                              className="font-bold text-sm text-[#172554] hover:text-[#4F46E5] block truncate"
                            >
                              {b.college_name}
                            </Link>
                            <div className="text-xs font-medium text-[#4F46E5]">
                              {b.branch}
                              {b.historical_percentile != null && (
                                <span className="text-[#64748B] ml-2 font-mono">
                                  ({b.historical_percentile.toFixed(2)}%ile)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBookmark(b.key)}
                            className="p-2 text-[#64748B] hover:text-red-600 rounded-lg hover:bg-white cursor-pointer"
                            title="Remove from shortlist"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap justify-between items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          saveStoredBookmarks([]);
                          showToast("Shortlist cleared", "info");
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={compareShortlisted}
                        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer"
                      >
                        Compare Top{" "}
                        {Math.min(
                          4,
                          new Set(bookmarks.map((b) => b.college_code)).size
                        )}{" "}
                        Colleges
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {modalType === "terms" && (
              <div className="space-y-3 text-sm text-[#64748B] leading-relaxed">
                <p>
                  CAP Compass is provided as an educational decision-support
                  utility for engineering aspirants in Maharashtra.
                </p>
                <p>
                  All historical cutoffs, calibrated category estimates, and
                  trend projections are derived from 2023–2026 CAP rounds and do
                  not guarantee future seat allotment.
                </p>
              </div>
            )}

            {modalType === "privacy" && (
              <div className="space-y-3 text-sm text-[#64748B] leading-relaxed">
                <p>
                  CAP Compass respects your privacy. Guest scores and shortlists
                  remain in local browser storage; signed-in Google profiles
                  sync securely over TLS to encrypted PostgreSQL storage with
                  server-side session revocation.
                </p>
                <p>
                  We never sell or share student records with third-party
                  marketers or admission agents.
                </p>
              </div>
            )}

            {modalType === "disclaimer" && (
              <div className="space-y-3 text-sm text-[#64748B] leading-relaxed">
                <p className="font-semibold text-[#172554]">
                  Important Notice Regarding MHT-CET CAP Counselling:
                </p>
                <p>
                  1. CAP Compass is an independent analytics platform and is{" "}
                  <strong>not affiliated with</strong> the State Common Entrance
                  Test Cell, Maharashtra or DTE.
                </p>
                <p>
                  2. Admission bands reflect historical cutoff margins, not
                  guaranteed allotment probabilities.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-[0_-4px_16px_rgba(23,37,84,0.05)] pb-safe print:hidden"
      >
        <div className="grid grid-cols-5 h-16 px-1">
          {[
            { href: "/", label: "Predict", icon: Compass, active: pathname === "/" },
            { href: "/map", label: "Map", icon: MapPin, active: pathname.startsWith("/map") },
            {
              href: "/explorer",
              label: "Colleges",
              icon: Building2,
              active:
                pathname.startsWith("/explorer") ||
                pathname.startsWith("/college"),
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMobileOpen(false)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                  tab.active ? "text-[#4F46E5]" : "text-[#64748B]"
                }`}
              >
                <span
                  className={`p-1.5 rounded-xl transition-colors ${
                    tab.active ? "bg-[#EEF2FF]" : ""
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span>{tab.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
              mobileOpen ? "text-[#4F46E5]" : "text-[#64748B]"
            }`}
          >
            <span
              className={`p-1.5 rounded-xl transition-colors ${
                mobileOpen ? "bg-[#EEF2FF]" : ""
              }`}
            >
              <LayoutGrid size={18} />
            </span>
            <span>Tools</span>
          </button>

          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              pathname.startsWith("/login") ? "text-[#4F46E5]" : "text-[#64748B]"
            }`}
          >
            <span
              className={`relative p-1.5 rounded-xl transition-colors ${
                pathname.startsWith("/login") ? "bg-[#EEF2FF]" : ""
              }`}
            >
              <User size={18} />
              {authSession && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </span>
            <span>{authSession ? "Account" : "Login"}</span>
          </Link>
        </div>
      </nav>

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
