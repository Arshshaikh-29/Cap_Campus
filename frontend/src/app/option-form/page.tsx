"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Sparkles,
  FileSpreadsheet,
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Crown,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  MapPin,
  BookOpen,
  Globe,
  ExternalLink,
  Bookmark,
  CloudUpload,
  FolderOpen,
  Wand2,
} from "lucide-react";
import { getStoredBookmarks } from "@/components/NavigationShell";
import { showToast } from "@/components/ui/ToastProvider";
import { formatCategory } from "@/lib/categories";
import {
  GPAY_NUMBER,
  PlanSession,
  escapeCSVCell,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";
import { getStoredAuth } from "@/lib/auth";

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
  "Nagpur",
  "Nashik",
  "Chhatrapati Sambhajinagar",
  "Kolhapur",
  "Sangli",
  "Thane",
];

const FREE_PREVIEW_LIMIT = 10;

export default function OptionFormBuilderPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"percentile" | "rank">("percentile");
  const [percentile, setPercentile] = useState("96.50");
  const [rank, setRank] = useState("12000");
  const [category, setCategory] = useState("GOPENS");
  const [incomeBelow8L, setIncomeBelow8L] = useState<boolean>(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
    "Computer Science and Engineering",
  ]);
  const [selectedCities, setSelectedCities] = useState<string[]>([
    "Pune",
    "Mumbai",
  ]);
  const [strategy, setStrategy] = useState<"balanced" | "dream_heavy" | "safe_first">("balanced");
  const [maxChoices, setMaxChoices] = useState<number>(30);

  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<any[]>([]);
  const [studentMeta, setStudentMeta] = useState<any>(null);
  const [advice, setAdvice] = useState<string[]>([]);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [serverLockedCount, setServerLockedCount] = useState<number>(0);
  const [serverLockedTeasers, setServerLockedTeasers] = useState<any[]>([]);
  const [serverTotalGenerated, setServerTotalGenerated] = useState<number>(0);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });

  // Mistake Auditor & Cloud Sync state
  const [auditing, setAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [savingCloud, setSavingCloud] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => undefined);

    const syncPlan = () => setPlanSession(getStoredPlan());
    syncPlan();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get("p");
      const rParam = params.get("r");
      const catParam = params.get("cat");
      const bParam = params.get("b");
      const cParam = params.get("c");
      if (pParam || rParam) {
        if (rParam && !pParam) {
          setInputType("rank");
          setRank(rParam);
        } else if (pParam) {
          setInputType("percentile");
          setPercentile(pParam);
        }
        if (catParam) setCategory(catParam.toUpperCase());
        if (bParam) {
          setSelectedBranches(
            bParam.split(",").map((s) => s.trim()).filter(Boolean)
          );
        }
        if (cParam) {
          setSelectedCities(
            cParam.split(",").map((s) => s.trim()).filter(Boolean)
          );
        }
      }
    }

    window.addEventListener("cap_plan_updated", syncPlan);
    return () => window.removeEventListener("cap_plan_updated", syncPlan);
  }, []);

  const proActive = isProActive(planSession);

  const toggleItem = (
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) => {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const runAudit = async (targetChoices?: any[], overrideToken?: string) => {
    const listToAudit = targetChoices ?? choices;
    if (!listToAudit.length) return;
    setAuditing(true);
    try {
      const payload: Record<string, unknown> = {
        category,
        income_below_8l: incomeBelow8L,
        choices: listToAudit.slice(0, 80).map((c) => ({
          college_code: String(c.college_code),
          branch: String(c.branch),
          choice_code: c.choice_code ? String(c.choice_code) : null,
        })),
      };
      if (inputType === "percentile") {
        payload.percentile = parseFloat(percentile);
      } else {
        payload.rank = parseFloat(rank);
      }
      const tok = overrideToken ?? getStoredPlan().entitlementToken;
      const headers: Record<string, string> = {};
      if (tok) headers["X-Entitlement-Token"] = tok;
      const res = await axios.post(`${API_BASE}/option-form/audit`, payload, {
        headers,
      });
      setAuditReport(res.data);
    } catch {
      showToast("Could not run Option Form audit. Check your score.", "error");
    } finally {
      setAuditing(false);
    }
  };

  const generateForm = async (overrideToken?: string) => {
    setLoading(true);
    setAuditReport(null);
    try {
      const payload: any = {
        category,
        branches: selectedBranches.length ? selectedBranches : null,
        cities: selectedCities.length ? selectedCities : null,
        strategy,
        max_choices: maxChoices,
      };
      if (inputType === "percentile") {
        payload.percentile = parseFloat(percentile);
      } else {
        payload.rank = parseFloat(rank);
      }
      const token = overrideToken ?? getStoredPlan().entitlementToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers["X-Entitlement-Token"] = token;
      }
      const res = await axios.post(`${API_BASE}/option-form/generate`, payload, {
        headers,
      });
      const nextChoices = res.data.choices || [];
      setChoices(nextChoices);
      setStudentMeta(res.data.student || null);
      setAdvice(res.data.advice || []);
      setHealthScore(res.data.health_score ?? 90);
      setServerLockedCount(Number(res.data.locked_choices_count || 0));
      setServerLockedTeasers(res.data.locked_teasers || []);
      setServerTotalGenerated(
        Number(res.data.total_generated || nextChoices.length)
      );
      setHasGenerated(true);
      if (nextChoices.length > 0) {
        runAudit(nextChoices, token);
      }
    } catch (err: any) {
      showToast(
        err?.response?.data?.detail ||
          "Could not generate Option Form. Please check your score input.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Automatically re-fetch full 30-60 choices & audit report the instant user unlocks Pro
  useEffect(() => {
    if (hasGenerated && proActive && planSession.entitlementToken) {
      if (serverLockedCount > 0) {
        generateForm(planSession.entitlementToken);
      } else if (auditReport && !auditReport.is_pro) {
        runAudit(choices, planSession.entitlementToken);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proActive, planSession.entitlementToken]);

  const importShortlistForAudit = () => {
    const saved = getStoredBookmarks();
    if (!saved.length) {
      showToast("Bookmark colleges in Predictor or Explorer first.", "info");
      return;
    }
    const mapped = saved.map((b, idx) => ({
      preference_no: idx + 1,
      college_code: b.college_code,
      college_name: b.college_name,
      city: b.city,
      branch: b.branch,
      choice_code: "",
      tier:
        b.prediction_category === "Historically Within Range"
          ? "Safe"
          : b.prediction_category === "Ambitious"
          ? "Dream"
          : "Target",
      historical_percentile: b.historical_percentile ?? null,
      historical_rank: b.historical_rank ?? null,
    }));
    setChoices(mapped);
    setServerLockedCount(0);
    setServerLockedTeasers([]);
    setServerTotalGenerated(mapped.length);
    setHasGenerated(true);
    runAudit(mapped);
    showToast(`Imported ${mapped.length} shortlisted choices & scanned mistakes`, "success");
  };

  const applyProAutoFixAndTfws = () => {
    if (!proActive || !auditReport?.is_pro) {
      openUpgradeModal(
        "pro",
        "Auto-fix fatal DTE ordering blunders & inject official TFWS Zero-Tuition Choice Codes"
      );
      return;
    }
    if (auditReport?.optimized_choices?.length) {
      setChoices(auditReport.optimized_choices);
      runAudit(auditReport.optimized_choices);
      showToast(
        `Applied optimal DTE order & injected ${auditReport.summary?.missing_tfws_codes || 0} TFWS codes`,
        "success"
      );
    }
  };

  const saveFormToCloud = async () => {
    const auth = getStoredAuth();
    if (!auth?.token) {
      showToast("Sign in via Student Portal (/login) to sync forms to cloud.", "info");
      return;
    }
    if (!proActive && choices.length > FREE_PREVIEW_LIMIT) {
      openUpgradeModal("pro", "Save up to 60 Option Form preferences to Cloud");
      return;
    }
    setSavingCloud(true);
    try {
      const scoreLabel =
        inputType === "percentile" ? `${percentile} %ile` : `Rank #${rank}`;
      await axios.post(
        `${API_BASE}/option-form/save`,
        {
          title: `${category} CAP Option Form`,
          category,
          score_label: scoreLabel,
          choices: choices.map((c, idx) => ({
            preference_no: idx + 1,
            college_code: c.college_code,
            choice_code: c.choice_code || "",
            college_name: c.college_name,
            city: c.city,
            branch: c.branch,
            band: c.tier,
            historical_percentile: c.historical_percentile,
            historical_rank: c.historical_rank,
          })),
        },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      showToast("Option Form saved to your Student Account!", "success");
    } catch {
      showToast("Could not save Option Form. Please sign in again.", "error");
    } finally {
      setSavingCloud(false);
    }
  };

  const loadSavedFormFromCloud = async () => {
    const auth = getStoredAuth();
    if (!auth?.token) {
      showToast("Sign in via Student Portal (/login) to load saved forms.", "info");
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/option-form/saved`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.data?.found || !res.data?.form?.choices?.length) {
        showToast("No cloud-saved Option Form found on your account yet.", "info");
        return;
      }
      const savedForm = res.data.form;
      const loaded = savedForm.choices.map((c: any, idx: number) => ({
        preference_no: idx + 1,
        college_code: c.college_code,
        choice_code: c.choice_code,
        college_name: c.college_name,
        city: c.city,
        branch: c.branch,
        tier: c.band || "Target",
        historical_percentile: c.historical_percentile,
        historical_rank: c.historical_rank,
      }));
      if (savedForm.category) setCategory(savedForm.category);
      setChoices(loaded);
      setServerLockedCount(0);
      setServerLockedTeasers([]);
      setHasGenerated(true);
      runAudit(loaded);
      showToast(`Loaded "${savedForm.title}" (${loaded.length} choices)`, "success");
    } catch {
      showToast("Could not load saved Option Form.", "error");
    }
  };

  const recordExportAudit = (format: "csv" | "pdf", count: number) => {
    const auth = getStoredAuth();
    const headers: Record<string, string> = {};
    if (auth?.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }
    axios
      .post(
        `${API_BASE}/audit/export`,
        { export_type: "option_form", format, record_count: count },
        { headers }
      )
      .catch(() => undefined);
  };

  // Detect live DTE ordering mistakes when user manually reorders choices
  const liveOrderWarnings = useMemo(() => {
    const warnings: string[] = [];
    let seenSafe = false;
    let misorderedCount = 0;
    for (const c of choices) {
      if (c.tier === "Safe") seenSafe = true;
      if (seenSafe && c.tier === "Dream") misorderedCount += 1;
    }
    if (misorderedCount > 0) {
      warnings.push(
        `Warning: ${misorderedCount} Dream option(s) are placed BELOW a Safe option — Safe allotment will block betterment.`
      );
    }
    return warnings;
  }, [choices]);

  const tierCounts = useMemo(() => {
    return {
      dream: choices.filter((c) => c.tier === "Dream").length,
      target: choices.filter((c) => c.tier === "Target").length,
      safe: choices.filter((c) => c.tier === "Safe").length,
    };
  }, [choices]);

  const moveChoice = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= choices.length) return;
    const copy = [...choices];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setChoices(copy.map((c, idx) => ({ ...c, preference_no: idx + 1 })));
  };

  const removeChoice = (index: number) => {
    const copy = choices.filter((_, i) => i !== index);
    setChoices(copy.map((c, idx) => ({ ...c, preference_no: idx + 1 })));
  };

  const copyChoiceCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const copyAllChoiceCodes = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Copy all ordered 9-digit DTE Choice Codes in 1 click for CET Cell portal entry"
      );
      return;
    }
    const codes = choices
      .map((c, idx) => `${idx + 1}. ${c.choice_code || c.college_code} — ${c.college_name} (${c.branch})`)
      .join("\n");
    navigator.clipboard?.writeText(codes);
    showToast(`Copied all ${choices.length} ordered Choice Codes!`, "success");
  };

  const exportOptionFormCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export your complete CET-Ready Option Form CSV with CAP Pro Pass"
      );
      return;
    }
    if (!choices.length) return;
    const headers = [
      "Preference_No",
      "DTE_Choice_Code",
      "Institute_Code",
      "College_Name",
      "City",
      "Branch",
      "Strategy_Tier",
      "Category_Cutoff_Percentile",
      "Category_Cutoff_Rank",
      "Margin_Percentile",
      "Seat_Basis",
      "Official_Website",
    ];
    const rows = choices.map((c, idx) =>
      [
        idx + 1,
        c.choice_code || "",
        c.college_code,
        c.college_name,
        c.city,
        c.branch,
        c.tier,
        c.historical_percentile != null ? Number(c.historical_percentile).toFixed(2) : "",
        c.historical_rank != null ? Math.round(c.historical_rank) : "",
        c.margin_percentile != null ? Number(c.margin_percentile).toFixed(2) : "",
        c.is_estimate ? `Calibrated (${c.basis_category})` : `Direct (${c.basis_category || category})`,
        c.official_website || c.cet_portal_url || "",
      ]
        .map(escapeCSVCell)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_Option_Form_${category}_${choices.length}_Choices.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordExportAudit("csv", choices.length);
  };

  const visibleChoices = proActive
    ? choices
    : choices.slice(0, FREE_PREVIEW_LIMIT);
  const totalChoicePool = Math.max(serverTotalGenerated, choices.length);
  const lockedCount = proActive
    ? 0
    : Math.max(serverLockedCount, choices.length - visibleChoices.length);

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-1 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172554]">
              Smart Option Form &amp; Mistake Auditor
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B]">
              Generate Dream &rarr; Target &rarr; Safe DTE preferences, audit ordering blunders, and inject TFWS zero-tuition codes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={importShortlistForAudit}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
            >
              <Bookmark size={14} className="text-[#4F46E5]" /> Audit Shortlist
            </button>
            <button
              type="button"
              onClick={loadSavedFormFromCloud}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen size={14} className="text-[#4F46E5]" /> Load Saved
            </button>
            {!proActive && (
              <button
                type="button"
                onClick={() =>
                  openUpgradeModal(
                    "pro",
                    "Unlock all 60 Option Form choices + Mistake Auto-Fix + TFWS Code Injection"
                  )
                }
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Crown size={14} /> Unlock Pro (₹199)
              </button>
            )}
          </div>
        </div>

        {/* Builder Config Card */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs p-6 sm:p-8 space-y-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Score Mode & Value */}
            <div className="md:col-span-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  MHT-CET Score
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-[#E2E8F0] text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setInputType("percentile")}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      inputType === "percentile"
                        ? "bg-white text-[#172554] shadow-2xs"
                        : "text-[#64748B]"
                    }`}
                  >
                    %ile
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputType("rank")}
                    className={`px-2 py-0.5 rounded-md cursor-pointer ${
                      inputType === "rank"
                        ? "bg-white text-[#172554] shadow-2xs"
                        : "text-[#64748B]"
                    }`}
                  >
                    Rank
                  </button>
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
                placeholder={inputType === "percentile" ? "96.50" : "12000"}
                className="w-full px-4 py-3 text-lg font-mono tabular-nums font-bold text-[#172554] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/15"
              />
            </div>

            {/* Category */}
            <div className="md:col-span-4 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Reservation Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3.5 text-sm font-semibold text-[#1E293B] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5]"
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

            {/* Family Income TFWS Scanner Toggle */}
            <div className="md:col-span-3 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                TFWS Eligibility (&lt; ₹8L)
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(true)}
                  className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                    incomeBelow8L
                      ? "bg-[#4F46E5] text-white"
                      : "text-[#64748B]"
                  }`}
                >
                  &lt; ₹8L (Scan TFWS)
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeBelow8L(false)}
                  className={`py-2.5 rounded-lg text-xs font-bold cursor-pointer ${
                    !incomeBelow8L
                      ? "bg-white text-[#172554] shadow-2xs"
                      : "text-[#64748B]"
                  }`}
                >
                  &ge; ₹8L
                </button>
              </div>
            </div>

            {/* Target List Length */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Form Size
              </label>
              <select
                value={maxChoices}
                onChange={(e) => setMaxChoices(Number(e.target.value))}
                className="w-full px-3 py-3.5 text-sm font-mono font-bold text-[#172554] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5]"
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
                <option value={60}>60</option>
              </select>
            </div>
          </div>

          {/* Multi-select Branches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <BookOpen size={13} className="text-[#4F46E5]" /> Target Branches
              </span>
              {selectedBranches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBranches([])}
                  className="text-[11px] font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BRANCH_OPTIONS.map((b) => {
                const active = selectedBranches.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() =>
                      toggleItem(selectedBranches, setSelectedBranches, b)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      active
                        ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                        : "bg-[#F8FAFC] hover:bg-slate-100 text-[#1E293B] border-[#E2E8F0]"
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-select Cities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <MapPin size={13} className="text-[#4F46E5]" /> Preferred Cities
              </span>
              {selectedCities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCities([])}
                  className="text-[11px] font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CITY_OPTIONS.map((c) => {
                const active = selectedCities.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      toggleItem(selectedCities, setSelectedCities, c)
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      active
                        ? "bg-[#172554] text-white border-[#172554]"
                        : "bg-[#F8FAFC] hover:bg-slate-100 text-[#1E293B] border-[#E2E8F0]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategy Cards + Generate CTA */}
          <div className="pt-4 border-t border-[#E2E8F0] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
              {[
                {
                  id: "balanced",
                  title: "Balanced CAP Mix",
                  desc: "20% Dream • 45% Target • 35% Safe",
                },
                {
                  id: "dream_heavy",
                  title: "Dream Betterment",
                  desc: "35% Dream • 40% Target • 25% Safe",
                },
                {
                  id: "safe_first",
                  title: "High-Safety Net",
                  desc: "10% Dream • 40% Target • 50% Safe",
                },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategy(s.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    strategy === s.id
                      ? "bg-[#EEF2FF] border-[#4F46E5]"
                      : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold text-[#172554]">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => generateForm()}
              disabled={loading}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-sm px-7 py-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loading ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Sparkles size={17} />
              )}
              {loading ? "Building Sheet..." : "Generate Option Form"}
            </button>
          </div>
        </div>

        {/* Generated Option Form Output */}
        {hasGenerated && (
          <div className="space-y-6">
            {/* Pro Mistake Auditor & Zero-Tuition TFWS Diagnostic Strip */}
            {auditReport && (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 space-y-4 print:hidden">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
                        CAP Mistake &amp; TFWS Audit
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          auditReport.safety_score >= 85
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        Safety {auditReport.safety_score}/100 ({auditReport.risk_level})
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">
                      {auditReport.summary.ordering_blunders} Ordering Blunder(s) •{" "}
                      {auditReport.summary.missing_tfws_codes} Missing TFWS Zero-Tuition Code(s) •{" "}
                      {auditReport.summary.safe_backups} Safe Backup(s)
                      {auditReport.summary.verified_tuition_at_stake_inr > 0 &&
                        ` • Up to ₹${(
                          auditReport.summary.verified_tuition_at_stake_inr / 100000
                        ).toFixed(2)}L Tuition Waiver Available`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={auditing}
                      onClick={() => runAudit()}
                      className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} className={auditing ? "animate-spin" : ""} />
                      Re-Scan Form
                    </button>
                    {(auditReport.summary.ordering_blunders > 0 ||
                      auditReport.summary.missing_tfws_codes > 0) && (
                      <button
                        type="button"
                        onClick={applyProAutoFixAndTfws}
                        className="px-4 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        {!proActive && <Lock size={12} />}
                        <Wand2 size={13} /> Auto-Fix Order + Inject{" "}
                        {auditReport.summary.missing_tfws_codes} TFWS Codes
                      </button>
                    )}
                  </div>
                </div>

                {auditReport.issues?.length > 0 && (
                  <div className="space-y-2">
                    {auditReport.issues.slice(0, 4).map((iss: any, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          iss.severity === "critical"
                            ? "bg-rose-50/70 border-rose-200 text-rose-900"
                            : "bg-[#EEF2FF] border-[#4F46E5]/20 text-[#172554]"
                        }`}
                      >
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">{iss.title}</div>
                          <div className="text-[11px] opacity-85 mt-0.5">{iss.detail}</div>
                        </div>
                      </div>
                    ))}

                    {!proActive &&
                      (auditReport.summary.locked_issues_count > 0 ||
                        auditReport.summary.locked_tfws_count > 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            openUpgradeModal(
                              "pro",
                              "Reveal every Option Form blunder line & auto-inject TFWS Zero-Tuition Choice Codes"
                            )
                          }
                          className="w-full p-3 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-semibold flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Lock size={13} className="text-[#C7D2FE]" />
                            +{auditReport.summary.locked_issues_count} hidden audit finding(s) &amp;{" "}
                            {auditReport.summary.locked_tfws_count} official TFWS zero-tuition code(s) ready
                          </span>
                          <span className="text-[#C7D2FE] font-bold shrink-0">
                            Unlock Auto-Fix (₹199) &rarr;
                          </span>
                        </button>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Health Score & Summary Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 bg-[#172554] text-white rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#C7D2FE]">
                    Option Form Health Score
                  </div>
                  <div className="text-4xl font-extrabold font-mono tabular-nums mt-1">
                    {Math.max(
                      30,
                      healthScore - (liveOrderWarnings.length > 0 ? 25 : 0)
                    )}
                    <span className="text-lg text-slate-400">/100</span>
                  </div>
                  {studentMeta && (
                    <div className="text-xs font-mono text-slate-300 mt-2">
                      {Number(studentMeta.percentile).toFixed(2)}%ile &harr; Rank #
                      {Number(studentMeta.rank).toLocaleString()}
                    </div>
                  )}
                </div>
                <ShieldCheck
                  size={44}
                  className={
                    liveOrderWarnings.length > 0
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }
                />
              </div>

              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70">
                    <div className="text-[11px] font-bold text-rose-700 uppercase">
                      Dream Choices
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#172554]">
                      {tierCounts.dream}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#4F46E5]/20">
                    <div className="text-[11px] font-bold text-[#4F46E5] uppercase">
                      Target Choices
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#172554]">
                      {tierCounts.target}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase">
                      Safe Backups
                    </div>
                    <div className="text-2xl font-extrabold font-mono tabular-nums text-[#172554]">
                      {tierCounts.safe}
                    </div>
                  </div>
                </div>

                {/* Live Strategy Warnings */}
                <div className="space-y-1.5">
                  {[...liveOrderWarnings, ...advice].slice(0, 2).map((msg, i) => {
                    const isWarn =
                      msg.startsWith("Warning:") ||
                      msg.includes("Fewer") ||
                      msg.includes("Short");
                    return (
                      <div
                        key={i}
                        className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                          isWarn
                            ? "bg-rose-50 text-rose-900 border border-rose-200"
                            : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        }`}
                      >
                        {isWarn ? (
                          <AlertTriangle size={14} className="shrink-0" />
                        ) : (
                          <CheckCircle2 size={14} className="shrink-0" />
                        )}
                        <span>{msg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Table Actions */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#172554]">
                    Ordered CAP Option Form ({choices.length} Preferences)
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Copy official 9-digit Choice Codes directly into the CET Cell portal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={copyAllChoiceCodes}
                    className="px-3.5 py-2 rounded-xl bg-[#EEF2FF] hover:bg-[#E0E7FF] text-xs font-semibold text-[#4F46E5] flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} />}
                    <Copy size={13} /> Copy All Codes
                  </button>
                  <button
                    type="button"
                    onClick={saveFormToCloud}
                    disabled={savingCloud}
                    className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
                  >
                    <CloudUpload size={14} className="text-[#4F46E5]" /> Save Cloud
                  </button>
                  <button
                    type="button"
                    onClick={exportOptionFormCSV}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} className="text-[#4F46E5]" />}
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!proActive) {
                        openUpgradeModal(
                          "pro",
                          "Print / Save your full Option Form PDF with CAP Pro Pass"
                        );
                        return;
                      }
                      recordExportAudit("pdf", choices.length);
                      window.print();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {!proActive && <Lock size={12} className="text-[#C7D2FE]" />}
                    <Download size={14} /> Print PDF
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3 px-4 w-20">Pref #</th>
                      <th className="py-3 px-4 w-36">Choice Code</th>
                      <th className="py-3 px-4">Institute &amp; Branch</th>
                      <th className="py-3 px-4 w-28">Tier</th>
                      <th className="py-3 px-4 text-right">{category} Cutoff</th>
                      <th className="py-3 px-4 text-right print:hidden">Reorder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {visibleChoices.map((c, idx) => {
                      const tierStyle =
                        c.tier === "Safe"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : c.tier === "Target"
                          ? "bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/20"
                          : "bg-rose-50 text-rose-700 border-rose-200";
                      return (
                        <tr
                          key={`${c.college_code}-${c.branch}-${c.choice_code || idx}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono tabular-nums font-extrabold text-[#172554] text-sm">
                            #{String(idx + 1).padStart(2, "0")}
                          </td>
                          <td className="py-3.5 px-4">
                            {c.choice_code ? (
                              <button
                                type="button"
                                onClick={() => copyChoiceCode(c.choice_code)}
                                className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px] font-bold bg-[#F8FAFC] hover:bg-[#EEF2FF] hover:text-[#4F46E5] px-2.5 py-1 rounded-md border border-[#E2E8F0] cursor-pointer"
                                title="Click to copy official DTE Choice Code"
                              >
                                {c.choice_code}
                                {copiedCode === c.choice_code ? (
                                  <Check size={11} className="text-emerald-600" />
                                ) : (
                                  <Copy size={11} className="text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="font-mono text-slate-400">
                                {c.college_code}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                href={`/college/${c.college_code}`}
                                className="font-bold text-[#172554] hover:text-[#4F46E5] leading-snug"
                              >
                                {c.college_name}
                              </Link>
                              {c.basis_category === "TFWS" && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  TFWS ₹0 Tuition
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="text-[#4F46E5] font-semibold">
                                {c.branch}
                              </span>
                              <span>•</span>
                              <span>{c.city}</span>
                              {(c.official_website || c.cet_portal_url) && (
                                <>
                                  <span className="print:hidden">•</span>
                                  <a
                                    href={c.official_website || c.cet_portal_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#64748B] hover:text-[#4F46E5] hover:underline print:hidden"
                                  >
                                    <Globe size={10} className="text-[#4F46E5]" />
                                    {c.website_domain || "CET Profile"}
                                    <ExternalLink size={9} />
                                  </a>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tierStyle}`}
                            >
                              {c.tier}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <div className="font-bold text-[#172554]">
                              {c.historical_percentile != null
                                ? `${Number(c.historical_percentile).toFixed(2)} %`
                                : "N/A"}
                            </div>
                            {c.historical_rank != null && (
                              <div className="text-[11px] text-[#4F46E5] font-semibold">
                                Rank #{Math.round(c.historical_rank).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right print:hidden">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveChoice(idx, -1)}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChoice(idx, 1)}
                                disabled={idx === visibleChoices.length - 1}
                                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeChoice(idx)}
                                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                                title="Remove Choice"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Locked Preview Rows (#11, #12, #13) for Free Users */}
                    {lockedCount > 0 &&
                      serverLockedTeasers.map((t, tIdx) => (
                        <tr
                          key={`teaser-${tIdx}`}
                          onClick={() =>
                            openUpgradeModal(
                              "pro",
                              `Unlock all ${totalChoicePool} ordered CAP Option Form choices`
                            )
                          }
                          className="bg-[#F8FAFC]/80 hover:bg-[#EEF2FF]/40 cursor-pointer transition-colors print:hidden"
                        >
                          <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-[#64748B] text-sm">
                            #{String(t.preference_no).padStart(2, "0")}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#4F46E5] bg-[#EEF2FF] px-2.5 py-1 rounded-md">
                              <Lock size={10} /> PRO CODE
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-400 select-none blur-[4px]">
                              Locked Target Engineering Institute Maharashtra
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-0.5">
                              <span className="text-[#4F46E5] font-semibold">
                                {t.branch}
                              </span>{" "}
                              • {t.city}
                              {t.nirf_median_lpa != null && (
                                <span className="ml-2 font-mono text-emerald-700 font-semibold">
                                  • NIRF ₹{Number(t.nirf_median_lpa).toFixed(1)}L
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/20">
                              {t.tier}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-[#172554]">
                            {t.historical_percentile != null
                              ? `${Number(t.historical_percentile).toFixed(2)} %`
                              : "Locked"}
                          </td>
                          <td className="py-3.5 px-4 text-right text-[11px] font-bold text-[#4F46E5]">
                            Unlock &rarr;
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pro Unlock Gate when Free */}
              {lockedCount > 0 && (
                <div className="p-8 bg-[#172554] text-white border-t border-[#E2E8F0] text-center space-y-4 print:hidden">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#C7D2FE] text-xs font-bold">
                    <Lock size={13} /> +{lockedCount} More Target &amp; Safe Backup Choices Locked
                  </div>
                  <h3 className="text-xl font-extrabold">
                    Unlock Your Complete {totalChoicePool}-Choice DTE Option Form
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                    Get all {totalChoicePool} ordered preferences, 1-click Mistake Auto-Fix, TFWS Zero-Tuition Code injection, and CSV/PDF export for{" "}
                    <strong className="text-white font-mono">₹199</strong> (GPay{" "}
                    <strong className="font-mono text-white">{GPAY_NUMBER}</strong>).
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openUpgradeModal(
                        "pro",
                        `Unlock all ${totalChoicePool} ordered CAP Option Form choices`
                      )
                    }
                    className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-sm px-7 py-3.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Crown size={16} /> Unlock CAP Pro Pass — ₹199
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
