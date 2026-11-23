"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ShieldCheck,
  Sparkles,
  Bookmark,
  Crown,
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
  UserCheck,
} from "lucide-react";
import {
  AuthSession,
  clearStoredAuth,
  getStoredAuth,
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

  // Quick Profile Save state
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

    // Discover Google Client ID from backend /api/auth/config (so setting GOOGLE_CLIENT_ID in Render works automatically)
    axios
      .get(`${API_BASE}/auth/config`)
      .then((res) => {
        if (res.data?.google_client_id) {
          setClientId(res.data.google_client_id);
        }
      })
      .catch(() => undefined)
      .finally(() => setConfigLoaded(true));

    // Refresh current session from server if already logged in
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

  // Dynamically load official Google Identity Services script
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

      // Merge cloud shortlist + local shortlist seamlessly
      const merged = mergeBookmarks(getStoredBookmarks(), user.bookmarks || []);
      saveStoredBookmarks(merged);

      // Push merged shortlist back to cloud if local had additional items
      if (merged.length > (user.bookmarks?.length || 0)) {
        try {
          await syncProfileToCloud({ bookmarks: merged });
        } catch {
          // non-blocking
        }
      }

      // Auto-restore Pro/VIP pass linked to this Google email!
      if (entitlement?.entitlement_token) {
        saveStoredPlan({
          plan: entitlement.plan,
          accessKey: entitlement.access_key,
          entitlementToken: entitlement.entitlement_token,
          fullName: entitlement.full_name,
          status: "approved",
          utrNumber: entitlement.utr_number,
        });
        setStatusMsg(
          `Signed in as ${user.full_name} — Your ${String(entitlement.plan).toUpperCase()} Pass was automatically restored!`
        );
      } else {
        setStatusMsg(`Welcome, ${user.full_name}! Your shortlist is now cloud-synced.`);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail ||
          "Google Sign-In verification failed. Please try again."
      );
    } finally {
      setSigningIn(false);
    }
  };

  // Render official Google Identity Services button once ready
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
        shape: "pill",
        logo_alignment: "left",
      });
    } catch (err) {
      console.error("GIS init error", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gisReady, clientId, auth]);

  const handleSaveCloudProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
            ? "Percentile must be between 0 and 100."
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
        setStatusMsg(
          `Synced ${updated.bookmarks.length} shortlisted colleges & your ${savedCategory} profile to your Google account!`
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail || "Could not sync profile right now. Try again."
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = () => {
    window.google?.accounts?.id?.disableAutoSelect?.();
    clearStoredAuth();
    setStatusMsg("Signed out safely. Local shortlist remains on this device.");
  };

  const proActive = isProActive(planSession);

  const buildProfileQuery = () => {
    const qs = new URLSearchParams();
    if (scoreVal.trim()) {
      qs.set(inputType === "percentile" ? "p" : "r", scoreVal.trim());
    }
    if (savedCategory) qs.set("cat", savedCategory);
    return qs.toString();
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Portal Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Official Google OAuth 2.0 Student Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {auth
              ? `Welcome back, ${auth.user.full_name.split(" ")[0]}`
              : "Sign in to CAP Compass with Google"}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            Sync your shortlisted Maharashtra engineering colleges, saved MHT-CET
            percentile/rank, and automatically restore your CAP Pro / VIP Pass
            across mobile and laptop.
          </p>
        </div>

        {/* Status / Error Alerts */}
        {statusMsg && (
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
            <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
            <AlertCircle size={17} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!auth ? (
          /* SIGNED-OUT PORTAL VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Sign-In Card */}
            <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center text-electric-blue">
                  <UserCheck size={24} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  One-Click Student Sign-In
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Zero passwords to remember. CAP Compass verifies your official
                  Google Identity Token server-side and issues a signed session
                  token — we never see your Google password.
                </p>

                <div className="pt-3">
                  {signingIn ? (
                    <div className="py-4 px-5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center gap-2.5 text-sm font-bold text-electric-blue">
                      <RefreshCw size={16} className="animate-spin" />
                      Verifying Google ID Token...
                    </div>
                  ) : clientId ? (
                    <div className="space-y-3">
                      <div
                        ref={googleBtnRef}
                        className="min-h-[44px] flex items-center justify-start"
                      />
                      {!gisReady && (
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <RefreshCw size={12} className="animate-spin" />
                          Loading Google Identity button...
                        </div>
                      )}
                    </div>
                  ) : configLoaded ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 space-y-2.5 text-xs text-amber-950">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <Lock size={14} /> Google OAuth Client ID Setup Required
                      </div>
                      <p className="leading-relaxed text-amber-900/90">
                        The Google Login Portal backend &amp; security verification
                        are live and ready! To enable the live{" "}
                        <strong>Sign in with Google</strong> button, add your free
                        Google Cloud OAuth Client ID:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900/90">
                        <li>
                          Open{" "}
                          <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline inline-flex items-center gap-0.5"
                          >
                            Google Cloud Console <ExternalLink size={10} />
                          </a>{" "}
                          → <strong>Create Credentials → OAuth client ID → Web application</strong>.
                        </li>
                        <li>
                          Add Authorized JavaScript Origins:{" "}
                          <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono">
                            https://cap-campus.vercel.app
                          </code>{" "}
                          and{" "}
                          <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono">
                            http://localhost:3000
                          </code>
                          .
                        </li>
                        <li>
                          Set{" "}
                          <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold">
                            GOOGLE_CLIENT_ID
                          </code>{" "}
                          in your Render Environment Variables (frontend picks it up
                          automatically via <code>/api/auth/config</code>!).
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="py-4 text-xs text-slate-400 flex items-center gap-2">
                      <RefreshCw size={13} className="animate-spin" /> Checking
                      portal auth configuration...
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  HMAC-SHA256 Signed Sessions
                </span>
                <Link
                  href="/?start=1"
                  className="font-semibold text-electric-blue hover:underline"
                >
                  Continue as Guest &rarr;
                </Link>
              </div>
            </div>

            {/* Right Benefits Card */}
            <div className="lg:col-span-6 bg-[#0B1120] text-white rounded-3xl p-8 border border-slate-800 shadow-lg flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-teal-300 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} /> Why Sign In With Google?
                </div>
                <h3 className="text-xl font-extrabold leading-snug">
                  Keep Your 2026 CAP Counselling Plan Synced Everywhere
                </h3>
                <div className="space-y-3.5 pt-1">
                  {[
                    {
                      icon: Cloud,
                      title: "Cloud-Synced Shortlist Across Devices",
                      desc: "Shortlist colleges on your phone and instantly open them on your laptop during live CAP Option Form filling.",
                    },
                    {
                      icon: Crown,
                      title: "Automatic CAP Pro / VIP Pass Restoration",
                      desc: "Bought CAP Pro (₹199) or VIP (₹499) with your Gmail? Signing in automatically restores your paid pass with zero keys to re-enter.",
                    },
                    {
                      icon: Compass,
                      title: "Saved MHT-CET Score & Category Profile",
                      desc: "Store your percentile/rank and reservation quota once and jump straight into Predictor, Option Form & Betterment Radar.",
                    },
                  ].map((b) => {
                    const Icon = b.icon;
                    return (
                      <div
                        key={b.title}
                        className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10"
                      >
                        <div className="w-8 h-8 rounded-lg bg-electric-blue/20 text-blue-300 flex items-center justify-center shrink-0">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {b.title}
                          </div>
                          <div className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                            {b.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-3 border-t border-white/10">
                Built with OWASP-hardened server-side token verification by{" "}
                <strong className="text-white">Arsh Shaikh</strong>.
              </div>
            </div>
          </div>
        ) : (
          /* SIGNED-IN STUDENT PORTAL DASHBOARD */
          <div className="space-y-6">
            {/* Profile Hero Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {auth.user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={auth.user.avatar_url}
                    alt={auth.user.full_name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-2xl border-2 border-electric-blue/30 object-cover shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-electric-blue text-white flex items-center justify-center font-extrabold text-2xl">
                    {auth.user.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {auth.user.full_name}
                    </h2>
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        proActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {proActive
                        ? `${planSession.plan.toUpperCase()} PASS ACTIVE`
                        : "STARTER FREE"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {auth.user.email}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <Cloud size={12} /> Cloud sync active • {bookmarks.length}{" "}
                    shortlisted colleges
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {!proActive && (
                  <button
                    type="button"
                    onClick={() => openUpgradeModal("pro")}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-electric-blue to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Crown size={14} /> Upgrade Pro • ₹199
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveCloudProfile()}
                  disabled={syncing}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    className={syncing ? "animate-spin text-electric-blue" : ""}
                  />
                  {syncing ? "Syncing..." : "Sync Shortlist Now"}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} /> Sign Out
                </button>
              </div>
            </div>

            {/* Two-Column Dashboard: Saved Score Profile + Quick Tools */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Saved MHT-CET Score & Category Cloud Form */}
              <form
                onSubmit={handleSaveCloudProfile}
                className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-5"
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-electric-blue">
                    Cloud-Saved Aspirant Profile
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Your MHT-CET Score &amp; Reservation Quota
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                    {(["percentile", "rank"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setInputType(t)}
                        className={`py-2 rounded-lg cursor-pointer transition-all ${
                          inputType === t
                            ? "bg-white text-slate-900 shadow-2xs"
                            : "text-slate-500"
                        }`}
                      >
                        {t === "percentile"
                          ? "MHT-CET Percentile"
                          : "State Merit Rank"}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {inputType === "percentile"
                        ? "Saved Percentile (0 – 100)"
                        : "Saved State Merit Rank"}
                    </label>
                    <input
                      type="number"
                      step={inputType === "percentile" ? "0.01" : "1"}
                      placeholder={inputType === "percentile" ? "96.85" : "11500"}
                      value={scoreVal}
                      onChange={(e) => setScoreVal(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono tabular-nums font-bold text-base focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Saved Reservation Category
                    </label>
                    <select
                      value={savedCategory}
                      onChange={(e) => setSavedCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:border-electric-blue"
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
                  className="w-full py-3.5 rounded-xl bg-electric-blue hover:bg-blue-600 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Cloud size={16} />
                  {syncing
                    ? "Saving to Cloud..."
                    : "Save Profile & Sync Shortlist"}
                </button>
              </form>

              {/* Quick-Launch Counselling Workspace */}
              <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 space-y-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    One-Click Launchers (2023–2026 Rounds 1–4)
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Run Tools With Your Saved Profile
                  </h3>
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
                      title: "ROI & Fee Finder",
                      desc: "Girls/OBC/TFWS net fees",
                      href: `/roi-finder?${buildProfileQuery()}`,
                    },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.title}
                        href={tool.href}
                        className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-electric-blue/40 hover:shadow-xs transition-all flex flex-col justify-between gap-3"
                      >
                        <div className="w-9 h-9 rounded-xl bg-electric-blue/10 text-electric-blue flex items-center justify-center">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                            {tool.title}
                            <ArrowRight size={13} className="text-electric-blue" />
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {tool.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Shortlist Preview */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Bookmark size={13} className="text-electric-blue" />
                      Cloud Shortlist ({bookmarks.length})
                    </span>
                    <Link
                      href="/compare"
                      className="text-electric-blue font-semibold hover:underline"
                    >
                      Compare Shortlisted &rarr;
                    </Link>
                  </div>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No colleges shortlisted yet. Bookmark colleges in the
                      Predictor or Explorer and click Sync!
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {bookmarks.slice(0, 6).map((b) => (
                        <Link
                          key={b.key}
                          href={`/college/${b.college_code}`}
                          className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 hover:bg-electric-blue/5 border border-slate-200/70 transition-colors"
                        >
                          <span className="font-semibold text-slate-800 truncate pr-2">
                            {b.college_code} • {b.college_name}
                          </span>
                          <span className="text-[11px] text-electric-blue font-medium shrink-0">
                            {b.branch}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
