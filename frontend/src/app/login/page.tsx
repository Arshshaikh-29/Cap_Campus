"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ShieldCheck,
  Bookmark,
  Cloud,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ArrowRight,
  Compass,
  ListOrdered,
  Radar,
  Wallet,
  AlertCircle,
  Lock,
  ExternalLink,
  Sparkles,
  GitCompare,
  BarChart3,
  BookOpenCheck,
  ShieldAlert,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Card, StatCard, Badge } from "@/components/ui/Primitives";
import { showToast } from "@/components/ui/ToastProvider";
import {
  AuthSession,
  clearStoredAuth,
  getStoredAuth,
  logoutFromServer,
  mergeBookmarks,
  saveStoredAuth,
  syncProfileToCloud,
} from "@/lib/auth";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";
import {
  PlanSession,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
  saveStoredPlan,
} from "@/lib/plan";
import { formatCategory } from "@/lib/categories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const ENV_GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            opts: {
              theme?: string;
              size?: string;
              width?: number;
              text?: string;
              shape?: string;
              logo_alignment?: string;
            }
          ) => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

const QUICK_CATEGORIES = [
  "GOPENS",
  "GOBCS",
  "GSEBCS",
  "EWS",
  "TFWS",
  "GSCS",
  "GSTS",
  "LOPENS",
  "MI",
];

export default function GoogleLoginPortalPage() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [clientId, setClientId] = useState<string>(ENV_GOOGLE_CLIENT_ID);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const [signingIn, setSigningIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [scoreVal, setScoreVal] = useState("");
  const [savedCategory, setSavedCategory] = useState("GOPENS");

  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncLocal = () => {
      const a = getStoredAuth();
      setAuth(a);
      setPlanSession(getStoredPlan());
      setBookmarks(getStoredBookmarks());
      if (a?.user) {
        setInputType(a.user.saved_input_type || "percentile");
        setScoreVal(
          a.user.saved_score != null ? String(a.user.saved_score) : ""
        );
        setSavedCategory(a.user.saved_category || "GOPENS");
      }
    };
    syncLocal();

    axios
      .get(`${API_BASE}/auth/config`)
      .then((res) => {
        if (res.data?.google_client_id) {
          setClientId(res.data.google_client_id);
        }
      })
      .catch(() => undefined)
      .finally(() => setConfigLoaded(true));

    const existing = getStoredAuth();
    if (existing?.token) {
      axios
        .get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${existing.token}` },
        })
        .then((res) => {
          if (res.data?.user) {
            saveStoredAuth({ token: existing.token, user: res.data.user });
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
        })
        .catch((err) => {
          if (err?.response?.status === 401) {
            clearStoredAuth();
          }
        });
    }

    window.addEventListener("cap_auth_updated", syncLocal);
    window.addEventListener("cap_plan_updated", syncLocal);
    window.addEventListener("cap_bookmarks_updated", syncLocal);
    return () => {
      window.removeEventListener("cap_auth_updated", syncLocal);
      window.removeEventListener("cap_plan_updated", syncLocal);
      window.removeEventListener("cap_bookmarks_updated", syncLocal);
    };
  }, []);

  useEffect(() => {
    if (!clientId || auth) return;
    const existingScript = document.getElementById("google-gsi-client");
    if (window.google?.accounts?.id) {
      setGisReady(true);
      return;
    }
    if (existingScript) {
      existingScript.addEventListener("load", () => setGisReady(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    script.onerror = () =>
      setErrorMsg("Could not load Google Sign-In script. Check your network or ad-blocker.");
    document.head.appendChild(script);
  }, [clientId, auth]);

  const handleGoogleCredential = async (credential: string) => {
    setSigningIn(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, { credential });
      const { token, user, entitlement } = res.data;
      if (!token || !user) {
        throw new Error("Invalid authentication response.");
      }

      saveStoredAuth({ token, user });

      const merged = mergeBookmarks(getStoredBookmarks(), user.bookmarks || []);
      saveStoredBookmarks(merged);

      if (merged.length > (user.bookmarks?.length || 0)) {
        try {
          await syncProfileToCloud({ bookmarks: merged });
        } catch {
          // non-blocking
        }
      }

      if (entitlement?.entitlement_token) {
        saveStoredPlan({
          plan: entitlement.plan,
          accessKey: entitlement.access_key,
          entitlementToken: entitlement.entitlement_token,
          fullName: entitlement.full_name,
          status: "approved",
          utrNumber: entitlement.utr_number,
        });
        const msg = `Signed in as ${user.full_name} — ${String(entitlement.plan).toUpperCase()} Pass restored!`;
        setStatusMsg(msg);
        showToast("Welcome back!", "success", msg);
      } else {
        const msg = `Welcome, ${user.full_name}! Cloud shortlist sync is active.`;
        setStatusMsg(msg);
        showToast("Signed in successfully", "success", msg);
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Google Sign-In verification failed. Please try again.";
      setErrorMsg(detail);
      showToast("Sign-In failed", "error", detail);
    } finally {
      setSigningIn(false);
    }
  };

  useEffect(() => {
    if (!gisReady || !clientId || auth || !googleBtnRef.current) return;
    if (!window.google?.accounts?.id) return;
    try {
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            handleGoogleCredential(response.credential);
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "filled_blue",
        size: "large",
        width: 310,
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
      });
    } catch {
      setErrorMsg("Unable to initialize Google Sign-In button. Please refresh and try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gisReady, clientId, auth]);

  const handleSaveCloudProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (syncing) return;
    setSyncing(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      const parsedScore = scoreVal.trim() ? parseFloat(scoreVal) : null;
      if (
        parsedScore != null &&
        (isNaN(parsedScore) ||
          (inputType === "percentile" && (parsedScore <= 0 || parsedScore > 100)) ||
          (inputType === "rank" && parsedScore < 1))
      ) {
        setErrorMsg(
          inputType === "percentile"
            ? "Percentile must be between 0.01 and 100."
            : "State Merit Rank must be at least 1."
        );
        setSyncing(false);
        return;
      }

      const updated = await syncProfileToCloud({
        saved_input_type: inputType,
        saved_score: parsedScore,
        saved_category: savedCategory,
        bookmarks: getStoredBookmarks(),
      });
      if (updated) {
        const msg = `Synced ${updated.bookmarks.length} shortlisted colleges & ${savedCategory} profile to cloud.`;
        setStatusMsg(msg);
        showToast("Cloud profile saved", "success", msg);
      }
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || "Could not sync profile right now. Try again.";
      setErrorMsg(detail);
      showToast("Sync error", "error", detail);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    await logoutFromServer();
    setStatusMsg("Signed out & session revoked on server.");
    showToast("Signed out safely", "info", "Your server session has been revoked.");
  };

  const proActive = isProActive(planSession);
  const role = auth?.user?.role || "student";
  const isAdminRole = role === "admin" || role === "super_admin";
  const isCounsellorRole = role === "counsellor";

  const buildProfileQuery = () => {
    const qs = new URLSearchParams();
    if (scoreVal.trim()) {
      qs.set(inputType === "percentile" ? "p" : "r", scoreVal.trim());
    }
    if (savedCategory) qs.set("cat", savedCategory);
    return qs.toString();
  };

  if (!auth) {
    /* COMMERCIAL SAAS SPLIT-SCREEN AUTHENTICATION EXPERIENCE */
    return (
      <div className="flex-1 bg-[#F8FAFC] py-8 sm:py-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-5xl w-full bg-white rounded-3xl border border-[#E2E8F0] shadow-[0_12px_40px_-16px_rgba(23,37,84,0.12)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Deep Navy Brand Identity Panel */}
          <div className="lg:col-span-5 bg-[#172554] text-white p-8 sm:p-10 flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <BrandLogo variant="primary" theme="dark" size="lg" />
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Your CAP Workspace
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sync your shortlist, score profile, and CAP Pro pass across devices.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200 pt-1">
                <li className="flex items-center gap-2.5">
                  <Cloud size={15} className="text-[#C7D2FE] shrink-0" />
                  Cloud-synced college shortlist
                </li>
                <li className="flex items-center gap-2.5">
                  <Sparkles size={15} className="text-[#C7D2FE] shrink-0" />
                  Automatic CAP Pro / VIP restore
                </li>
                <li className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="text-[#C7D2FE] shrink-0" />
                  Verified Google OAuth 2.0 login
                </li>
              </ul>
            </div>

            <div className="text-[11px] text-slate-400">
              CAP Compass • MHT-CET 2026
            </div>
          </div>

          {/* Right Pure White Sign-In Surface */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#172554]">
                  Sign In
                </h2>
                <p className="text-xs text-[#64748B]">
                  Use your Google account to continue.
                </p>
              </div>

              {statusMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                {signingIn ? (
                  <div className="py-3.5 px-4 rounded-xl bg-[#EEF2FF] border border-[#4F46E5]/20 flex items-center justify-center gap-2.5 text-sm font-semibold text-[#4F46E5]">
                    <RefreshCw size={16} className="animate-spin" />
                    Verifying Google identity token...
                  </div>
                ) : clientId ? (
                  <div className="space-y-3">
                    <div
                      ref={googleBtnRef}
                      className="min-h-[44px] flex items-center justify-start"
                    />
                    {!gisReady && (
                      <div className="text-xs text-[#64748B] flex items-center gap-2">
                        <RefreshCw size={12} className="animate-spin text-[#4F46E5]" />
                        Loading Google Sign-In...
                      </div>
                    )}
                  </div>
                ) : configLoaded ? (
                  <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-2 text-xs text-orange-950">
                    <div className="font-bold flex items-center gap-1.5">
                      <Lock size={14} /> Google OAuth Client ID Setup Required
                    </div>
                    <p className="text-orange-900/90 leading-relaxed">
                      Set <code className="font-mono font-bold bg-white px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> in
                      your Render environment to activate one-click Google Sign-In.
                    </p>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline"
                    >
                      Open Google Cloud Console <ExternalLink size={11} />
                    </a>
                  </div>
                ) : (
                  <div className="py-3 text-xs text-[#64748B] flex items-center gap-2">
                    <RefreshCw size={13} className="animate-spin text-[#4F46E5]" />
                    Loading...
                  </div>
                )}
              </div>
            </div>

            <div className="pt-5 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <Link
                href="/admin"
                className="font-semibold text-[#64748B] hover:text-[#172554] inline-flex items-center gap-1.5"
              >
                <ShieldCheck size={14} className="text-[#4F46E5]" /> Administrator Console
              </Link>
              <Link
                href="/?start=1"
                className="font-semibold text-[#4F46E5] hover:text-[#4338CA] inline-flex items-center gap-1"
              >
                Continue as Guest <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* SIGNED-IN ROLE-AWARE WORKSPACE PORTAL */
  return (
    <div className="flex-1 bg-[#F8FAFC] py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Status / Error Alerts */}
        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Role-Based Administrator Banner (Shown ONLY for admin / super_admin DB roles) */}
        {isAdminRole && (
          <div className="rounded-2xl bg-[#172554] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    {role === "super_admin" ? "Super Administrator" : "Administrator"} Access Enabled
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#4F46E5] text-white">
                    {role}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Manage payment approvals, counselling leads, user RBAC permissions, and live security audit logs.
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#EEF2FF] text-[#172554] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              Open Admin Console <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Profile Hero Card */}
        <Card className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {auth.user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={auth.user.avatar_url}
                alt={auth.user.full_name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl border border-[#E2E8F0] object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#172554] text-white flex items-center justify-center font-extrabold text-xl">
                {auth.user.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#172554]">
                  {auth.user.full_name}
                </h1>
                <Badge tone={isAdminRole ? "navy" : "indigo"} className="font-mono uppercase">
                  {role}
                </Badge>
                <Badge tone={proActive ? "success" : "neutral"} className="font-mono uppercase">
                  {proActive ? `${planSession.plan} PASS` : "FREE TIER"}
                </Badge>
              </div>
              <div className="text-xs font-mono text-[#64748B]">
                {auth.user.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {!proActive && (
              <button
                type="button"
                onClick={() => openUpgradeModal("pro")}
                className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles size={14} /> Upgrade Pro • ₹199
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSaveCloudProfile()}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#172554] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={syncing ? "animate-spin text-[#4F46E5]" : "text-[#4F46E5]"}
              />
              {syncing ? "Syncing..." : "Sync Cloud"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </Card>

        {/* Real Account Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Shortlisted Colleges"
            value={bookmarks.length}
            sublabel="Synced with Neon PostgreSQL"
            icon={<Bookmark size={18} />}
            accent="indigo"
          />
          <StatCard
            label="Saved Score"
            value={scoreVal ? (inputType === "percentile" ? `${scoreVal}%` : `#${scoreVal}`) : "Not set"}
            sublabel={inputType === "percentile" ? "MHT-CET Percentile" : "State Merit Rank"}
            icon={<Compass size={18} />}
            accent="navy"
          />
          <StatCard
            label="Saved Category"
            value={savedCategory}
            sublabel="Reservation quota filter"
            icon={<ShieldCheck size={18} />}
            accent="indigo"
          />
          <StatCard
            label="Subscription"
            value={proActive ? planSession.plan.toUpperCase() : "FREE"}
            sublabel={proActive ? "Full 2026 season active" : "Upgrade for 60 choices"}
            icon={<Sparkles size={18} />}
            accent={proActive ? "success" : "navy"}
          />
        </div>

        {/* Role-Specific Counsellor Quick Strip */}
        {isCounsellorRole && (
          <Card className="p-5 bg-[#EEF2FF]/60 border-[#4F46E5]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
                Counsellor Workspace Tools
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Quick access to multi-college comparisons, multi-year cutoff analytics, and CAP documentation checklists.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/compare" className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#172554] inline-flex items-center gap-1.5 hover:border-[#4F46E5]">
                <GitCompare size={13} className="text-[#4F46E5]" /> Compare 4
              </Link>
              <Link href="/analytics" className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#172554] inline-flex items-center gap-1.5 hover:border-[#4F46E5]">
                <BarChart3 size={13} className="text-[#4F46E5]" /> Analytics
              </Link>
              <Link href="/cap-guide" className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#172554] inline-flex items-center gap-1.5 hover:border-[#4F46E5]">
                <BookOpenCheck size={13} className="text-[#4F46E5]" /> CAP Guide
              </Link>
            </div>
          </Card>
        )}

        {/* Two-Column Dashboard: Saved Profile Form + Quick Launchers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-6 p-6 sm:p-7">
            <form onSubmit={handleSaveCloudProfile} className="space-y-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                  Cloud-Saved Profile
                </div>
                <h2 className="text-lg font-bold text-[#172554] mt-0.5">
                  MHT-CET Score &amp; Reservation Quota
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-semibold">
                  {(["percentile", "rank"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInputType(t)}
                      className={`py-2 rounded-lg cursor-pointer transition-all ${
                        inputType === t
                          ? "bg-white text-[#172554] shadow-2xs border border-[#E2E8F0]"
                          : "text-[#64748B]"
                      }`}
                    >
                      {t === "percentile" ? "MHT-CET Percentile" : "State Merit Rank"}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                    {inputType === "percentile"
                      ? "Saved Percentile (0.01 – 100)"
                      : "Saved State Merit Rank"}
                  </label>
                  <input
                    type="number"
                    step={inputType === "percentile" ? "0.01" : "1"}
                    placeholder={inputType === "percentile" ? "96.85" : "11500"}
                    value={scoreVal}
                    onChange={(e) => setScoreVal(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-white font-mono font-bold text-sm text-[#172554] focus:outline-none focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                    Saved Reservation Category
                  </label>
                  <select
                    value={savedCategory}
                    onChange={(e) => setSavedCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-medium bg-white text-[#1E293B] focus:outline-none focus:border-[#4F46E5]"
                  >
                    {QUICK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {formatCategory(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={syncing}
                className="w-full py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Cloud size={16} />
                {syncing ? "Saving to Cloud..." : "Save Profile & Sync Shortlist"}
              </button>
            </form>
          </Card>

          <Card className="lg:col-span-6 p-6 sm:p-7 space-y-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F46E5]">
                Quick Launchers
              </div>
              <h2 className="text-lg font-bold text-[#172554] mt-0.5">
                Run Tools With Your Profile
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: Compass,
                  title: "College Predictor",
                  desc: "2026 CAP Rounds 1–4 matches",
                  href: `/?${buildProfileQuery() || "start=1"}`,
                },
                {
                  icon: ListOrdered,
                  title: "Smart Option Form",
                  desc: "Auto-ordered DTE choices",
                  href: `/option-form?${buildProfileQuery()}`,
                },
                {
                  icon: Radar,
                  title: "Betterment Radar",
                  desc: "R1 → R4 cutoff drops",
                  href: `/betterment?${buildProfileQuery()}`,
                },
                {
                  icon: Wallet,
                  title: "ROI & Net Fees",
                  desc: "Girls/OBC/TFWS fee waivers",
                  href: `/roi-finder?${buildProfileQuery()}`,
                },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#4F46E5]/50 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center group-hover:bg-[#4F46E5] group-hover:text-white transition-colors">
                      <Icon size={17} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#172554] flex items-center justify-between">
                        {tool.title}
                        <ArrowRight size={13} className="text-[#4F46E5]" />
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        {tool.desc}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0]">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-bold text-[#172554] flex items-center gap-1.5">
                  <Bookmark size={13} className="text-[#4F46E5]" />
                  Cloud Shortlist ({bookmarks.length})
                </span>
                <Link
                  href="/compare"
                  className="text-[#4F46E5] font-semibold hover:underline"
                >
                  Compare Shortlisted &rarr;
                </Link>
              </div>
              {bookmarks.length === 0 ? (
                <p className="text-xs text-[#64748B]">
                  No colleges shortlisted yet. Bookmark colleges in the Predictor, Map, or Explorer and click Sync.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {bookmarks.slice(0, 6).map((b) => (
                    <Link
                      key={b.key}
                      href={`/college/${b.college_code}`}
                      className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#EEF2FF]/60 border border-[#E2E8F0] transition-colors"
                    >
                      <span className="font-semibold text-[#172554] truncate pr-2">
                        {b.college_code} • {b.college_name}
                      </span>
                      <span className="text-[11px] text-[#4F46E5] font-medium shrink-0">
                        {b.branch}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
