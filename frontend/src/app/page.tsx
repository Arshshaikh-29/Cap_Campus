"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  MapPin,
  Percent,
  Hash,
  Sparkles,
  BookOpen,
  ShieldAlert,
  Award,
  TrendingUp,
  Compass,
  RefreshCw,
  Bookmark,
  Download,
  FileSpreadsheet,
  Search,
  SlidersHorizontal,
  ArrowLeftRight,
  Info,
  ListOrdered,
  Calculator,
  Crown,
  Lock,
  BarChart3,
  Smartphone,
  Check,
  X,
  Plus,
  Activity,
  BookOpenCheck,
  Code2,
  Share2,
  Globe,
  ExternalLink,
} from "lucide-react";
import axios from "axios";
import {
  BookmarkedItem,
  getStoredBookmarks,
  saveStoredBookmarks,
} from "@/components/NavigationShell";
import {
  GPAY_NUMBER,
  PlanSession,
  escapeCSVCell,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";
import { CATEGORY_LABELS, formatCategory } from "@/lib/categories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const PRIMARY_EIGHT_CATEGORIES: {
  code: string;
  name: string;
  desc: string;
}[] = [
  { code: "GOPENS", name: "OPEN", desc: "General State" },
  { code: "GOBCS", name: "OBC", desc: "Other Backward" },
  { code: "GSEBCS", name: "SEBC", desc: "Maratha Quota" },
  { code: "EWS", name: "EWS", desc: "Econ. Weaker" },
  { code: "TFWS", name: "TFWS", desc: "Fee Waiver" },
  { code: "GSCS", name: "SC", desc: "Scheduled Caste" },
  { code: "GSTS", name: "ST", desc: "Scheduled Tribe" },
  { code: "MI", name: "Minority", desc: "Linguistic / Rel." },
];

const CATEGORY_GROUPS: { label: string; codes: string[] }[] = [
  {
    label: "VJ/DT(A) & Nomadic Tribes (NT-1, NT-2, NT-3)",
    codes: [
      "GVJS",
      "GVJH",
      "GVJO",
      "GNT1S",
      "GNT1H",
      "GNT1O",
      "GNT2S",
      "GNT2H",
      "GNT2O",
      "GNT3S",
      "GNT3H",
      "GNT3O",
    ],
  },
  {
    label: "Ladies (30% Horizontal Quota)",
    codes: [
      "LOPENS",
      "LOPENH",
      "LOPENO",
      "LOBCS",
      "LOBCH",
      "LOBCO",
      "LSEBCS",
      "LSEBCH",
      "LSEBCO",
      "LSCS",
      "LSCH",
      "LSCO",
      "LSTS",
      "LSTH",
      "LSTO",
      "LVJS",
      "LVJH",
      "LVJO",
      "LNT1S",
      "LNT1H",
      "LNT1O",
      "LNT2S",
      "LNT2H",
      "LNT2O",
      "LNT3S",
      "LNT3H",
      "LNT3O",
    ],
  },
  {
    label: "Home University (H) & Other University (O) Pools",
    codes: [
      "GOPENH",
      "GOPENO",
      "GOBCH",
      "GOBCO",
      "GSEBCH",
      "GSEBCO",
      "GSCH",
      "GSCO",
      "GSTH",
      "GSTO",
    ],
  },
  {
    label: "Primary State-Level & Special Quotas",
    codes: ["GOPENS", "GOBCS", "GSEBCS", "EWS", "TFWS", "GSCS", "GSTS", "MI", "ORPHAN"],
  },
  {
    label: "Defence & PWD Quotas",
    codes: [
      "DEFOPENS",
      "DEFOBCS",
      "DEFSEBCS",
      "DEFSCS",
      "DEFSTS",
      "DEFVJS",
      "DEFNT1S",
      "DEFNT2S",
      "DEFNT3S",
      "DEFROBCS",
      "DEFRSEBCS",
      "DEFRSCS",
      "DEFRSTS",
      "DEFRVJS",
      "DEFRNT1S",
      "DEFRNT2S",
      "DEFRNT3S",
      "PWDOPENS",
      "PWDOBCS",
      "PWDSEBCS",
      "PWDSCS",
      "PWDSTS",
      "PWDVJS",
      "PWDNT1S",
      "PWDNT2S",
      "PWDNT3S",
      "PWDROBCS",
      "PWDRSEBCS",
      "PWDRSCS",
      "PWDRSTS",
      "PWDRVJS",
      "PWDRNT1S",
      "PWDRNT2S",
      "PWDRNT3S",
    ],
  },
];

const POPULAR_BRANCHES: { label: string; value: string }[] = [
  { label: "Computer Engg", value: "Computer Engineering" },
  { label: "IT", value: "Information Technology" },
  { label: "CSE", value: "Computer Science and Engineering" },
  { label: "AI & Data Science", value: "Artificial Intelligence and Data Science" },
  { label: "AI & Machine Learning", value: "Artificial Intelligence and Machine Learning" },
  { label: "ENTC", value: "Electronics and Telecommunication Engg" },
  { label: "Electronics & CS", value: "Electronics and Computer Science" },
  { label: "Electrical", value: "Electrical Engineering" },
  { label: "Mechanical", value: "Mechanical Engineering" },
  { label: "Civil", value: "Civil Engineering" },
];

const CS_IT_AI_BUNDLE = [
  "Computer Engineering",
  "Information Technology",
  "Computer Science and Engineering",
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
];

const POPULAR_CITIES: { label: string; value: string }[] = [
  { label: "Pune", value: "Pune" },
  { label: "Mumbai", value: "Mumbai" },
  { label: "Navi Mumbai", value: "Navi Mumbai" },
  { label: "Thane", value: "Thane" },
  { label: "Nagpur", value: "Nagpur" },
  { label: "Nashik", value: "Nashik" },
  { label: "Chh. Sambhajinagar", value: "Chhatrapati Sambhajinagar" },
  { label: "Kolhapur", value: "Kolhapur" },
  { label: "Sangli", value: "Sangli" },
];

const PUNE_MUMBAI_BUNDLE = ["Pune", "Mumbai", "Navi Mumbai"];

const PERCENTILE_PRESETS = ["99.5", "98.5", "96.0", "92.0", "85.0", "75.0"];
const RANK_PRESETS = ["1500", "5000", "12000", "25000", "45000", "75000"];

const CATEGORY_ORDER: Record<string, number> = {
  "Historically Within Range": 0,
  Moderate: 1,
  Ambitious: 2,
};

export default function Home() {
  const [step, setStep] = useState(1); // 1: Hero, 2: Score/Category, 3: Preferences, 4: Results
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{
    cities: string[];
    branches: string[];
    categories: string[];
  }>({
    cities: [],
    branches: [],
    categories: [],
  });

  const [form, setForm] = useState({
    inputType: "percentile" as "percentile" | "rank",
    percentile: "",
    rank: "",
    category: "GOPENS",
    branches: [] as string[],
    cities: [] as string[],
    round: "All",
  });

  const [conversionPreview, setConversionPreview] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);

  // Results interactive filter/sort/pagination state
  const [bandFilter, setBandFilter] = useState<string>("All");
  const [exactOnly, setExactOnly] = useState<boolean>(false);
  const [resultSearch, setResultSearch] = useState<string>("");
  const [resultSort, setResultSort] = useState<
    "best_match" | "cutoff_desc" | "rank_asc" | "margin_desc"
  >("best_match");
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setFilters(res.data))
      .catch((err) => console.error("Failed to load filters", err));

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get("p");
      const rParam = params.get("r");
      const catParam = params.get("cat");
      const bParam = params.get("b");
      const cParam = params.get("c");
      const rdParam = params.get("rd");

      if (pParam || rParam) {
        const parsedBranches = bParam
          ? bParam.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        const parsedCities = cParam
          ? cParam.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        const restored = {
          inputType: (rParam && !pParam ? "rank" : "percentile") as "percentile" | "rank",
          percentile: pParam || "",
          rank: rParam || "",
          category: (catParam || "GOPENS").toUpperCase(),
          branches: parsedBranches,
          cities: parsedCities,
          round: rdParam && ["1", "2", "3"].includes(rdParam) ? rdParam : "All",
        };
        setForm(restored);
        handlePredict(restored);
      } else if (params.get("start") === "1") {
        setStep(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live Percentile <-> Rank conversion preview
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.inputType === "percentile") {
        const val = parseFloat(form.percentile);
        if (!isNaN(val) && val > 0 && val <= 100) {
          axios
            .get(`${API_BASE}/convert`, { params: { percentile: val } })
            .then((res) => setConversionPreview(res.data))
            .catch(() => setConversionPreview(null));
        } else {
          setConversionPreview(null);
        }
      } else {
        const val = parseFloat(form.rank);
        if (!isNaN(val) && val >= 1) {
          axios
            .get(`${API_BASE}/convert`, { params: { rank: val } })
            .then((res) => setConversionPreview(res.data))
            .catch(() => setConversionPreview(null));
        } else {
          setConversionPreview(null);
        }
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [form.inputType, form.percentile, form.rank]);

  useEffect(() => {
    const sync = () => setBookmarks(getStoredBookmarks());
    const syncPlan = () => setPlanSession(getStoredPlan());
    sync();
    syncPlan();
    window.addEventListener("cap_bookmarks_updated", sync);
    window.addEventListener("cap_plan_updated", syncPlan);
    return () => {
      window.removeEventListener("cap_bookmarks_updated", sync);
      window.removeEventListener("cap_plan_updated", syncPlan);
    };
  }, []);

  const proActive = isProActive(planSession);
  const FREE_PREDICTION_LIMIT = 12;

  const bookmarkedKeys = useMemo(
    () => new Set(bookmarks.map((b) => b.key)),
    [bookmarks]
  );

  const toggleBookmark = (p: any) => {
    const key = `${p.college_code}|${p.branch}`;
    const existing = getStoredBookmarks();
    if (existing.some((item) => item.key === key)) {
      saveStoredBookmarks(existing.filter((item) => item.key !== key));
    } else {
      saveStoredBookmarks([
        ...existing,
        {
          key,
          college_code: p.college_code,
          college_name: p.college_name,
          city: p.city,
          branch: p.branch,
          historical_percentile: p.historical_percentile,
          historical_rank: p.historical_rank,
          prediction_category: p.prediction_category,
        },
      ]);
    }
  };

  const isScoreValid =
    form.inputType === "percentile"
      ? Boolean(
          form.percentile &&
            parseFloat(form.percentile) > 0 &&
            parseFloat(form.percentile) <= 100
        )
      : Boolean(form.rank && parseFloat(form.rank) >= 1);

  const isPrimaryCategory = useMemo(
    () => PRIMARY_EIGHT_CATEGORIES.some((c) => c.code === form.category),
    [form.category]
  );

  const toggleBranch = (b: string) => {
    setForm((prev) => ({
      ...prev,
      branches: prev.branches.includes(b)
        ? prev.branches.filter((x) => x !== b)
        : [...prev.branches, b],
    }));
  };

  const toggleCity = (c: string) => {
    setForm((prev) => ({
      ...prev,
      cities: prev.cities.includes(c)
        ? prev.cities.filter((x) => x !== c)
        : [...prev.cities, c],
    }));
  };

  const handlePredict = async (overrides?: Partial<typeof form>) => {
    const activeForm = { ...form, ...(overrides || {}) };
    setLoading(true);
    try {
      const payload: any = {
        category: activeForm.category,
        branches: activeForm.branches.length ? activeForm.branches : null,
        cities: activeForm.cities.length ? activeForm.cities : null,
        round_number:
          activeForm.round === "All" ? null : parseInt(activeForm.round, 10),
      };
      if (activeForm.inputType === "percentile") {
        payload.percentile = parseFloat(activeForm.percentile);
      } else {
        payload.rank = parseFloat(activeForm.rank);
      }

      const res = await axios.post(`${API_BASE}/predict`, payload);
      setPredictions(res.data.predictions || []);
      setStudentInfo(res.data.student || null);
      setFallbackUsed(Boolean(res.data.fallback_used));
      setBandFilter("All");
      setResultSearch("");
      setVisibleCount(30);
      setStep(4);
    } catch (err) {
      console.error(err);
      alert("Error generating predictions. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const basePredictions = useMemo(
    () => (exactOnly ? predictions.filter((p) => !p.is_estimate) : predictions),
    [predictions, exactOnly]
  );

  const counts = useMemo(() => {
    const within = basePredictions.filter(
      (p) => p.prediction_category === "Historically Within Range"
    ).length;
    const mod = basePredictions.filter(
      (p) => p.prediction_category === "Moderate"
    ).length;
    const amb = basePredictions.filter(
      (p) => p.prediction_category === "Ambitious"
    ).length;
    const saved = basePredictions.filter((p) =>
      bookmarkedKeys.has(`${p.college_code}|${p.branch}`)
    ).length;
    return { within, mod, amb, saved };
  }, [basePredictions, bookmarkedKeys]);

  const filteredPredictions = useMemo(() => {
    let list = [...basePredictions];
    if (bandFilter === "Bookmarked") {
      list = list.filter((p) =>
        bookmarkedKeys.has(`${p.college_code}|${p.branch}`)
      );
    } else if (bandFilter !== "All") {
      list = list.filter((p) => p.prediction_category === bandFilter);
    }

    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.college_name?.toLowerCase().includes(q) ||
          p.college_code?.toLowerCase().includes(q) ||
          p.branch?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (resultSort === "best_match") {
        const oa = CATEGORY_ORDER[a.prediction_category] ?? 9;
        const ob = CATEGORY_ORDER[b.prediction_category] ?? 9;
        if (oa !== ob) return oa - ob;
        return (a.historical_rank || 1e9) - (b.historical_rank || 1e9);
      }
      if (resultSort === "margin_desc") {
        if (form.inputType === "percentile") {
          return (
            (b.margin_percentile ?? b.margin ?? -999) -
            (a.margin_percentile ?? a.margin ?? -999)
          );
        }
        return (
          (b.margin_rank ?? b.margin ?? -999999) -
          (a.margin_rank ?? a.margin ?? -999999)
        );
      }
      if (resultSort === "rank_asc") {
        return (a.historical_rank || 1e9) - (b.historical_rank || 1e9);
      }
      // cutoff_desc
      return (b.historical_percentile || 0) - (a.historical_percentile || 0);
    });

    return list;
  }, [
    basePredictions,
    bandFilter,
    resultSearch,
    resultSort,
    form.inputType,
    bookmarkedKeys,
  ]);

  const buildCrossToolQuery = () => {
    const qs = new URLSearchParams();
    if (form.inputType === "percentile" && form.percentile) {
      qs.set("p", form.percentile);
    } else if (form.rank) {
      qs.set("r", form.rank);
    }
    if (form.category) qs.set("cat", form.category);
    if (form.branches.length) qs.set("b", form.branches.join(","));
    if (form.cities.length) qs.set("c", form.cities.join(","));
    if (form.round && form.round !== "All") qs.set("rd", form.round);
    return qs.toString();
  };

  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/?${buildCrossToolQuery()}`;
    navigator.clipboard?.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const exportCSV = () => {
    if (!proActive) {
      openUpgradeModal(
        "pro",
        "Export unlimited predictions & DTE Choice Codes to CSV with CAP Pro Pass"
      );
      return;
    }
    if (!filteredPredictions.length) return;
    const headers = [
      "Preference_Order",
      "DTE_Code",
      "Choice_Code",
      "College_Name",
      "City",
      "Branch",
      "Admission_Band",
      "Chance_Level",
      "Category_Percentile_Cutoff",
      "Category_Rank_Cutoff_2025_Scale",
      "Category_Rank_In_Source_Year",
      "Margin_Percentile",
      "Margin_Rank",
      "Requested_Category",
      "Basis_Category",
      "Seat_Type",
      "Year",
      "CAP_Round",
      "Official_Website",
      "NIRF_Median_LPA",
      "Annual_Open_Fee_INR",
    ];
    const rows = filteredPredictions.map((p, idx) =>
      [
        idx + 1,
        p.college_code,
        p.choice_code || "",
        p.college_name,
        p.city,
        p.branch,
        p.prediction_category,
        p.chance_level || "",
        p.historical_percentile != null
          ? p.historical_percentile.toFixed(2)
          : "",
        p.historical_rank != null ? Math.round(p.historical_rank) : "",
        p.cutoff_rank_in_year != null ? Math.round(p.cutoff_rank_in_year) : "",
        p.margin_percentile != null ? p.margin_percentile.toFixed(2) : "",
        p.margin_rank != null ? Math.round(p.margin_rank) : "",
        form.category,
        p.basis_category,
        p.is_estimate ? "Calibrated" : "Direct",
        p.year,
        p.round,
        p.official_website || p.cet_portal_url || "",
        p.nirf_median_lpa != null ? p.nirf_median_lpa : "",
        p.annual_fee_inr != null ? p.annual_fee_inr : "",
      ]
        .map(escapeCSVCell)
        .join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CAP_Compass_Predictions_${form.category}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderGroupedCategoryOptions = () => {
    const availableSet = new Set(filters.categories);
    return CATEGORY_GROUPS.map((grp) => {
      const codes = grp.codes.filter(
        (c) => availableSet.size === 0 || availableSet.has(c)
      );
      if (codes.length === 0) return null;
      return (
        <optgroup key={grp.label} label={grp.label}>
          {codes.map((c) => (
            <option key={c} value={c}>
              {formatCategory(c)}
            </option>
          ))}
        </optgroup>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-center bg-[#F8FAFC]">
      {step === 1 && (
        <section className="relative overflow-hidden py-16 lg:py-24 flex-1 flex flex-col">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-electric-blue/10 via-teal-accent/5 to-transparent rounded-full blur-3xl -z-10" />

          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-semibold tracking-wide uppercase">
                  <Sparkles size={14} /> MHT-CET Engineering Admissions 2023–2025
                </div>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  <Code2 size={13} className="text-blue-400" />
                  Made by Arsh Shaikh
                </Link>
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
                Navigate CAP Admissions with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-teal-accent">
                  Clarity.
                </span>
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                Explore 380 Maharashtra engineering colleges with{" "}
                <strong className="text-slate-900 font-semibold">
                  category-wise rank & percentile cutoffs
                </strong>{" "}
                across CAP Rounds 1–3, live Percentile &harr; Merit Rank
                conversion, and calibrated seat-pool insights.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="bg-electric-blue hover:bg-blue-600 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-electric-blue/25 hover:shadow-electric-blue/35 transition-all flex items-center justify-center gap-2 text-base group cursor-pointer"
                >
                  Predict My Colleges
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
                <Link
                  href="/explorer"
                  className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 font-semibold px-8 py-4 rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 text-base"
                >
                  Explore Cutoff Trends
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200/80">
                <div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    79,600+
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Verified Cutoff Records
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    380
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Engineering Institutes
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    95 Quotas
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Rank & Percentile Calibrated
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative">
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08)] p-6 relative z-10">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <div className="text-[11px] font-bold text-electric-blue uppercase tracking-wider">
                      Live 2025 CAP Benchmark (GOPENS)
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      Top Autonomous Cutoffs (Rank & %ile)
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                    <TrendingUp size={12} /> Verified
                  </div>
                </div>

                <div className="space-y-3.5">
                  {[
                    {
                      name: "VJTI Mumbai",
                      code: "3012",
                      branch: "Computer Engineering",
                      cutoff: "99.95 %ile",
                      rank: "Rank #109",
                      status: "Top Tier",
                      color:
                        "text-electric-blue bg-electric-blue/10 border-electric-blue/20",
                    },
                    {
                      name: "COEP Tech University, Pune",
                      code: "6006",
                      branch: "Computer Engineering",
                      cutoff: "99.90 %ile",
                      rank: "Rank #272",
                      status: "Top Tier",
                      color:
                        "text-electric-blue bg-electric-blue/10 border-electric-blue/20",
                    },
                    {
                      name: "SPIT Andheri, Mumbai",
                      code: "3215",
                      branch: "Computer Engineering",
                      cutoff: "99.80 %ile",
                      rank: "Rank #615",
                      status: "High Demand",
                      color:
                        "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
                    },
                    {
                      name: "PICT Pune",
                      code: "6271",
                      branch: "Computer Engineering",
                      cutoff: "99.71 %ile",
                      rank: "Rank #890",
                      status: "High Demand",
                      color:
                        "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
                    },
                  ].map((item, i) => (
                    <Link
                      key={i}
                      href={`/college/${item.code}`}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col gap-1.5 hover:border-electric-blue/40 hover:bg-white transition-all block"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-900 text-sm">
                          {item.name}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>{item.branch}</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {item.cutoff} • {item.rank}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                  <span>Based on official DTE / CET Cell data</span>
                  <button
                    onClick={() => setStep(2)}
                    className="text-electric-blue font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Try with your score <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-6 w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 rounded-2xl -z-10 opacity-10 transform rotate-2" />
            </div>
          </div>

          {/* BELOW THE FOLD: INDUSTRY CAPABILITIES, PRICING PREVIEW & FAQ */}
          <div className="max-w-7xl mx-auto px-6 mt-24 space-y-24 w-full">
            {/* 4-Card Platform Suite Showcase */}
            <div className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-electric-blue">
                  Built for Maharashtra CAP Admissions
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                  Everything You Need to Lock Your Best Engineering Seat
                </h2>
                <p className="text-sm sm:text-base text-slate-500">
                  From raw MHT-CET score estimation to a DTE-verified 60-choice
                  preference sheet ready for the State CET Cell portal.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    icon: Compass,
                    badge: "Dual Cutoff Engine",
                    title: "Category Rank & %ile Predictor",
                    desc: "Multi-branch & multi-city predictor calibrated across 95 CAP categories (S/H/O pools, Ladies 30%, EWS, TFWS, Minority) with dual Rank & Percentile margins.",
                    cta: "Launch Wizard",
                    action: () => setStep(2),
                    href: null,
                  },
                  {
                    icon: ListOrdered,
                    badge: "PRO Flagship",
                    title: "Smart CAP Option Form Builder",
                    desc: "Auto-generates an optimal Dream → Target → Safe preference list with official 9-digit DTE Choice Codes and live order-safety checks.",
                    cta: "Build Option Form",
                    action: null,
                    href: "/option-form",
                  },
                  {
                    icon: Activity,
                    badge: "NEW",
                    title: "What-If Score Impact Simulator",
                    desc: "Test how ±0.5, ±1 or ±2 percentile shifts unlock top institutes or put current seats at risk — with an interactive stacked chart and exact seat diffs.",
                    cta: "Simulate Score Impact",
                    action: null,
                    href: "/what-if",
                  },
                  {
                    icon: BookOpenCheck,
                    badge: "NEW • Free",
                    title: "CAP Guide & Document Checklist",
                    desc: "Personalized Maharashtra CAP document checklist by category (OBC/SEBC/SC/ST/EWS/TFWS/Minority) with progress saving, print mode & Freeze vs Betterment guide.",
                    cta: "Open CAP Guide",
                    action: null,
                    href: "/cap-guide",
                  },
                  {
                    icon: Calculator,
                    badge: "<0.3% Rank Error",
                    title: "Marks & Rank Calculator",
                    desc: "Convert expected PCM Marks (/200) or Percentile into exact 2023, 2024 & 2025 State Merit Ranks across 3.19L candidates.",
                    cta: "Open Calculator",
                    action: null,
                    href: "/rank-calculator",
                  },
                  {
                    icon: BarChart3,
                    badge: "3-Year Trends",
                    title: "Multi-Year Cutoff Analytics",
                    desc: "Visualize CAP Round 1–3 percentile drops, branch-by-branch competitiveness, and projected 2026 closing bands.",
                    cta: "Inspect Trends",
                    action: null,
                    href: "/analytics",
                  },
                ].map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs hover:shadow-md hover:border-electric-blue/35 transition-all flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-electric-blue/10 text-electric-blue flex items-center justify-center">
                            <Icon size={20} />
                          </div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                            {card.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          {card.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>
                      {card.href ? (
                        <Link
                          href={card.href}
                          className="text-xs font-bold text-electric-blue hover:underline inline-flex items-center gap-1"
                        >
                          {card.cta} <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={card.action!}
                          className="text-xs font-bold text-electric-blue hover:underline inline-flex items-center gap-1 cursor-pointer w-fit"
                        >
                          {card.cta} <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monetization Banner — Direct GPay 9920627188 */}
            <div className="bg-[#0B1120] text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute -top-28 -right-28 w-96 h-96 bg-electric-blue/25 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-teal-300 text-xs font-bold uppercase tracking-wider">
                    <Crown size={13} /> CAP Compass Pro &amp; 1-on-1 VIP Plans
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                    Unlock Unlimited Predictions &amp; Your Complete 60-Choice
                    DTE Option Form
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
                    One-time season pass with zero recurring subscription. Pay
                    instantly via Google Pay / UPI to{" "}
                    <strong className="font-mono text-white">
                      {GPAY_NUMBER}
                    </strong>{" "}
                    and activate with your personal Access Key.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => openUpgradeModal("pro")}
                      className="bg-electric-blue hover:bg-blue-500 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-electric-blue/30 flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles size={16} /> Unlock CAP Pro — ₹199
                    </button>
                    <button
                      type="button"
                      onClick={() => openUpgradeModal("vip")}
                      className="bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm px-6 py-3.5 rounded-xl flex items-center gap-2 cursor-pointer"
                    >
                      1-on-1 VIP Counselling — ₹499
                    </button>
                    <Link
                      href="/pricing"
                      className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4 px-2"
                    >
                      Compare All Plans &rarr;
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <Smartphone size={15} /> Official Google Pay / UPI
                    </div>
                    <span className="font-mono font-extrabold text-base text-white">
                      {GPAY_NUMBER}
                    </span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                      Unlock all 300+ matching colleges &amp; 3-year cutoff history
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                      Generate 60-choice DTE Option Form with 9-digit Choice Codes
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                      Unlimited CET-Ready CSV &amp; Printable PDF Exports
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-teal-400 shrink-0" />
                      VIP includes personal WhatsApp/Call review on {GPAY_NUMBER}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Interactive CAP Counselling FAQ Accordion */}
            <div className="max-w-3xl mx-auto space-y-6 pb-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Frequently Asked CAP Counselling Questions
                </h2>
                <p className="text-sm text-slate-500">
                  Clear answers on DTE seat pools, rank calibration, and CAP Pro
                  activation.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    q: "How accurate are the Category Rankwise and Percentile cutoffs?",
                    a: "CAP Compass uses 79,600+ official State CET Cell CAP Round 1–3 records from 2023, 2024, and 2025. Our data-driven RankScale maps Percentile ↔ State Merit Rank per year with <0.3% median error, and directly reports official closing ranks for exact category seats.",
                  },
                  {
                    q: "Why does Option Form ordering (Dream → Target → Safe) matter in DTE CAP?",
                    a: "The Maharashtra CET Cell allotment engine checks your Option #1 first, then #2, and stops at the first seat where your merit rank clears the cutoff. Placing a Safe college at #1 locks you out of Dream/Target colleges below it. Our Smart CAP Option Form Builder automatically enforces optimal DTE ordering.",
                  },
                  {
                    q: "What do S, H, and O mean at the end of category codes like GOPENS / GOPENH?",
                    a: "S = State Level seats (autonomous & minority institutes + state quota), H = Home University seats (70% seats in non-autonomous colleges within your 12th board university jurisdiction), and O = Other Than Home University seats (30% seats outside your home university).",
                  },
                  {
                    q: `How do I unlock CAP Pro (₹199) or VIP (₹499) via Google Pay (${GPAY_NUMBER})?`,
                    a: `Click Upgrade Pro, pay ₹199 (Pro) or ₹499 (VIP) via Google Pay / PhonePe / Paytm to mobile number ${GPAY_NUMBER}, and submit your 12-digit UPI UTR ID. You immediately receive a personal Access Key (e.g. CAP-PRO-XXXXXX) and can ping WhatsApp ${GPAY_NUMBER} for fast activation.`,
                  },
                ].map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                      >
                        <span className="text-sm font-bold text-slate-900">
                          {item.q}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 shrink-0 transition-transform ${
                            isOpen ? "rotate-180 text-electric-blue" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2 & 3: MODERN SAAS SPLIT-CARD ADMISSION WIZARD */}
      {(step === 2 || step === 3) && (
        <section className="py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.08),0_4px_16px_-4px_rgba(15,23,42,0.04)] overflow-hidden min-h-[620px]">
            {/* Left Stepper Panel */}
            <div className="md:col-span-4 bg-[#0B1120] text-white p-7 lg:p-8 flex flex-col justify-between relative overflow-hidden">
              {/* Top-left subtle radial mesh glow */}
              <div className="absolute -top-24 -left-24 w-80 h-80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.35),rgba(20,184,166,0.12)_55%,transparent_75%)] blur-2xl pointer-events-none" />
              <div className="absolute -bottom-28 -right-28 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-blue-400 font-bold tracking-wider uppercase text-[11px] mb-6">
                  <Compass size={13} /> Admission Wizard
                </div>
                <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-white leading-snug">
                  Find colleges matching your Category Rank & Percentile.
                </h2>

                {/* Connected Vertical Stepper */}
                <div className="relative mt-9 space-y-7">
                  {/* Continuous vertical track line */}
                  <div
                    className="absolute left-[15px] top-4 bottom-4 w-[1.5px] bg-white/10 pointer-events-none"
                    aria-hidden="true"
                  />
                  {/* Active progress fill line */}
                  <div
                    className="absolute left-[15px] top-4 w-[1.5px] bg-gradient-to-b from-electric-blue to-teal-400 transition-all duration-500 pointer-events-none"
                    style={{
                      height: step === 2 ? "0%" : step === 3 ? "50%" : "100%",
                    }}
                    aria-hidden="true"
                  />

                  {[
                    {
                      s: 2,
                      num: "01",
                      title: "Score & Category",
                      desc: "Percentile / Merit Rank & Seat Pool",
                    },
                    {
                      s: 3,
                      num: "02",
                      title: "Course Preferences",
                      desc: "Branch, City & CAP Round",
                    },
                    {
                      s: 4,
                      num: "03",
                      title: "Dual Cutoff Results",
                      desc: "Rankwise & Percentile Shortlist",
                    },
                  ].map((item) => {
                    const isActive = step === item.s;
                    const isCompleted = step > item.s;
                    return (
                      <button
                        key={item.s}
                        type="button"
                        disabled={item.s > step}
                        onClick={() => item.s <= step && setStep(item.s)}
                        className={`relative z-10 flex items-start gap-3.5 text-left w-full group transition-all ${
                          isActive
                            ? "opacity-100"
                            : isCompleted
                            ? "opacity-90 hover:opacity-100 cursor-pointer"
                            : "opacity-45"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-mono tabular-nums text-xs font-bold shrink-0 transition-all ${
                            isActive
                              ? "bg-electric-blue text-white ring-4 ring-electric-blue/30 shadow-[0_0_16px_rgba(37,99,235,0.6)]"
                              : isCompleted
                              ? "bg-teal-500/20 border border-teal-400/50 text-teal-300"
                              : "bg-[#0F172A] border border-white/15 text-slate-400"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            item.num
                          )}
                        </div>
                        <div className="pt-0.5">
                          <div
                            className={`text-sm font-semibold tracking-tight ${
                              isActive
                                ? "text-white"
                                : isCompleted
                                ? "text-slate-200"
                                : "text-slate-400"
                            }`}
                          >
                            {item.title}
                          </div>
                          <div
                            className={`text-xs mt-0.5 ${
                              isActive ? "text-slate-300" : "text-slate-400/80"
                            }`}
                          >
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom CAP Seat Level Codes Legend: Three Stacked Glassmorphic Badges */}
              <div className="relative z-10 pt-6 mt-8 border-t border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                  CAP Seat Level Codes
                </div>
                <div className="space-y-2">
                  {[
                    {
                      code: "S",
                      title: "State Level",
                      meta: "All-Maharashtra Pool",
                      pill: "bg-blue-500/20 text-blue-300 border-blue-400/30",
                    },
                    {
                      code: "H",
                      title: "Home University",
                      meta: "Local Univ. Jurisdiction",
                      pill: "bg-teal-500/20 text-teal-300 border-teal-400/30",
                    },
                    {
                      code: "O",
                      title: "Other Than Home Univ.",
                      meta: "Outside Univ. Quota",
                      pill: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
                    },
                  ].map((b) => (
                    <div
                      key={b.code}
                      className="bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`font-mono tabular-nums text-[11px] font-bold w-6 h-5 rounded-md border flex items-center justify-center shrink-0 ${b.pill}`}
                        >
                          {b.code}
                        </span>
                        <span className="text-xs font-semibold text-white/90 truncate">
                          {b.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {b.meta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Interactive Content Area */}
            <div className="md:col-span-8 p-7 sm:p-9 lg:p-10 flex flex-col justify-between bg-white">
              <AnimatePresence mode="wait">
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <div className="space-y-6">
                      {/* Header */}
                      <div>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                          Enter Your Score & Category
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Enter either your MHT-CET Percentile or State Merit
                          Rank — we automatically compute both and display
                          side-by-side category cutoffs.
                        </p>
                      </div>

                      {/* Score Input Mode Segmented Toggle */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Score Input Mode
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ ...form, inputType: "percentile" })
                            }
                            className={`py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              form.inputType === "percentile"
                                ? "bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/5"
                                : "text-slate-600 hover:text-slate-900 font-medium"
                            }`}
                          >
                            <Percent
                              size={15}
                              className={
                                form.inputType === "percentile"
                                  ? "text-electric-blue"
                                  : "text-slate-400"
                              }
                            />
                            MHT-CET Percentile
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ ...form, inputType: "rank" })
                            }
                            className={`py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              form.inputType === "rank"
                                ? "bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/5"
                                : "text-slate-600 hover:text-slate-900 font-medium"
                            }`}
                          >
                            <Hash
                              size={15}
                              className={
                                form.inputType === "rank"
                                  ? "text-electric-blue"
                                  : "text-slate-400"
                              }
                            />
                            State Merit Rank
                          </button>
                        </div>
                      </div>

                      {/* Score Input Box + Single Clean Horizontal Row of Quick Try Chips */}
                      {form.inputType === "percentile" ? (
                        <div className="space-y-2.5">
                          <label
                            htmlFor="percentile-input"
                            className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                          >
                            Your MHT-CET Percentile (0 – 100)
                          </label>
                          <div className="relative">
                            <input
                              id="percentile-input"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="96.45"
                              value={form.percentile}
                              onChange={(e) =>
                                setForm({ ...form, percentile: e.target.value })
                              }
                              className="w-full text-2xl font-mono tabular-nums font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium pl-4 pr-20 py-3.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-slate-200/90 text-slate-600 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg select-none pointer-events-none">
                              %ile
                            </span>
                          </div>

                          {/* Single clean horizontal row of Quick Try preset pills */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 mr-1">
                              Quick try:
                            </span>
                            {PERCENTILE_PRESETS.map((val) => {
                              const active = form.percentile === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    setForm({ ...form, percentile: val })
                                  }
                                  className={`text-xs font-mono tabular-nums px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                    active
                                      ? "bg-electric-blue text-white border-electric-blue font-semibold shadow-2xs"
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200/90 font-medium"
                                  }`}
                                >
                                  {val}%
                                </button>
                              );
                            })}
                          </div>

                          {/* Live Conversion Preview */}
                          {conversionPreview &&
                            conversionPreview.input_type === "percentile" && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-700">
                                  <ArrowLeftRight
                                    size={14}
                                    className="text-electric-blue shrink-0"
                                  />
                                  <span>
                                    2025 State Merit Rank:{" "}
                                    <strong className="font-mono tabular-nums text-electric-blue font-bold">
                                      #
                                      {Number(
                                        conversionPreview.estimated_rank
                                      ).toLocaleString()}
                                    </strong>{" "}
                                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                                      (2024: #
                                      {Number(
                                        conversionPreview.by_year?.["2024"] || 0
                                      ).toLocaleString()}{" "}
                                      • 2023: #
                                      {Number(
                                        conversionPreview.by_year?.["2023"] || 0
                                      ).toLocaleString()}
                                      )
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      inputType: "rank",
                                      rank: String(
                                        conversionPreview.estimated_rank
                                      ),
                                    })
                                  }
                                  className="text-[11px] font-mono tabular-nums font-semibold text-electric-blue hover:underline shrink-0 cursor-pointer"
                                >
                                  Switch to #
                                  {Number(
                                    conversionPreview.estimated_rank
                                  ).toLocaleString()}{" "}
                                  &rarr;
                                </button>
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <label
                            htmlFor="rank-input"
                            className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                          >
                            Your State Merit Rank
                          </label>
                          <div className="relative">
                            <input
                              id="rank-input"
                              type="number"
                              min="1"
                              placeholder="12500"
                              value={form.rank}
                              onChange={(e) =>
                                setForm({ ...form, rank: e.target.value })
                              }
                              className="w-full text-2xl font-mono tabular-nums font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-medium pl-4 pr-24 py-3.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-slate-200/90 text-slate-600 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg select-none pointer-events-none">
                              Rank #
                            </span>
                          </div>

                          {/* Single clean horizontal row of Quick Try preset pills */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 mr-1">
                              Quick try:
                            </span>
                            {RANK_PRESETS.map((val) => {
                              const active = form.rank === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    setForm({ ...form, rank: val })
                                  }
                                  className={`text-xs font-mono tabular-nums px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                    active
                                      ? "bg-electric-blue text-white border-electric-blue font-semibold shadow-2xs"
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200/90 font-medium"
                                  }`}
                                >
                                  #{Number(val).toLocaleString()}
                                </button>
                              );
                            })}
                          </div>

                          {/* Live Conversion Preview */}
                          {conversionPreview &&
                            conversionPreview.input_type === "rank" && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-700">
                                  <ArrowLeftRight
                                    size={14}
                                    className="text-electric-blue shrink-0"
                                  />
                                  <span>
                                    2025 Equivalent Percentile:{" "}
                                    <strong className="font-mono tabular-nums text-electric-blue font-bold">
                                      {Number(
                                        conversionPreview.estimated_percentile
                                      ).toFixed(2)}{" "}
                                      %ile
                                    </strong>{" "}
                                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                                      (2024:{" "}
                                      {Number(
                                        conversionPreview.by_year?.["2024"] || 0
                                      ).toFixed(2)}
                                      % • 2023:{" "}
                                      {Number(
                                        conversionPreview.by_year?.["2023"] || 0
                                      ).toFixed(2)}
                                      %)
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      inputType: "percentile",
                                      percentile: String(
                                        Number(
                                          conversionPreview.estimated_percentile
                                        ).toFixed(2)
                                      ),
                                    })
                                  }
                                  className="text-[11px] font-mono tabular-nums font-semibold text-electric-blue hover:underline shrink-0 cursor-pointer"
                                >
                                  Switch to{" "}
                                  {Number(
                                    conversionPreview.estimated_percentile
                                  ).toFixed(2)}
                                  % &rarr;
                                </button>
                              </div>
                            )}
                        </div>
                      )}

                      {/* Two-Tier Category Selector Overhaul */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Admission Category (Reservation / Quota)
                          </span>
                          <span className="font-mono tabular-nums text-[11px] font-semibold text-electric-blue bg-electric-blue/10 px-2 py-0.5 rounded-md">
                            Selected: {form.category}
                          </span>
                        </div>

                        {/* Tier 1: Top Eight Primary Categories as Structured Two-Line Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {PRIMARY_EIGHT_CATEGORIES.map((item) => {
                            const active = form.category === item.code;
                            return (
                              <button
                                key={item.code}
                                type="button"
                                onClick={() =>
                                  setForm({ ...form, category: item.code })
                                }
                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                                  active
                                    ? "bg-electric-blue/[0.06] border-electric-blue ring-2 ring-electric-blue/15 shadow-2xs"
                                    : "bg-white hover:bg-slate-50/90 border-slate-200/90 hover:border-slate-300 shadow-2xs"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={`text-sm font-bold tracking-tight ${
                                      active
                                        ? "text-electric-blue"
                                        : "text-slate-900"
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium truncate">
                                    {item.desc}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`font-mono tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                                      active
                                        ? "bg-electric-blue text-white border-electric-blue"
                                        : "bg-slate-100 text-slate-600 border-slate-200/80"
                                    }`}
                                  >
                                    {item.code}
                                  </span>
                                  {active && (
                                    <span className="w-2 h-2 rounded-full bg-electric-blue" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Tier 2: Compact "More Categories" Combobox Trigger for Sub-Quotas */}
                        <div
                          className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            !isPrimaryCategory
                              ? "bg-electric-blue/[0.06] border-electric-blue ring-2 ring-electric-blue/15"
                              : "bg-slate-50/90 border-slate-200/80"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pl-1">
                            <span className="text-xs font-bold text-slate-700 shrink-0">
                              More Categories:
                            </span>
                            <span className="text-[11px] text-slate-500 truncate">
                              {!isPrimaryCategory ? (
                                <strong className="text-electric-blue font-semibold">
                                  {formatCategory(form.category)}
                                </strong>
                              ) : (
                                "VJ/DT, NT-1/2/3, Ladies (30%), Home Univ., Defence & PWD"
                              )}
                            </span>
                          </div>
                          <div className="relative sm:w-64 shrink-0">
                            <select
                              aria-label="Admission Category"
                              value={form.category}
                              onChange={(e) =>
                                setForm({ ...form, category: e.target.value })
                              }
                              className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white border border-slate-200/90 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/15 cursor-pointer truncate"
                            >
                              {renderGroupedCategoryOptions()}
                            </select>
                            <ChevronDown
                              size={14}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                          </div>
                        </div>

                        {/* Clean Soft-Blue Callout Box */}
                        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                          <Info
                            size={15}
                            className="text-electric-blue shrink-0 mt-0.5"
                          />
                          <div>
                            Matches official CAP category cutoffs directly, and
                            calibrates both{" "}
                            <strong className="font-semibold text-slate-900">
                              Percentile
                            </strong>{" "}
                            and{" "}
                            <strong className="font-semibold text-slate-900">
                              State Merit Rank
                            </strong>{" "}
                            when a course only lists State-Level Open, TFWS, or
                            EWS seats.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sticky Action Footer (Back hidden on Step 2; two right-aligned primary actions) */}
                    <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-5 mt-6 border-t border-slate-200/80 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={!isScoreValid || loading}
                        onClick={() => handlePredict()}
                        className="px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold border border-indigo-200/90 bg-indigo-50/40 hover:bg-indigo-50/90 hover:border-indigo-300 text-indigo-950 disabled:opacity-45 disabled:pointer-events-none transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        {loading ? (
                          <RefreshCw
                            size={15}
                            className="animate-spin text-electric-blue"
                          />
                        ) : (
                          <Sparkles size={15} className="text-electric-blue" />
                        )}
                        Instant Predict (All Branches)
                      </button>
                      <button
                        type="button"
                        disabled={!isScoreValid}
                        onClick={() => setStep(3)}
                        className="group bg-electric-blue hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none text-white border border-electric-blue font-semibold px-6 py-3 rounded-xl shadow-md shadow-electric-blue/20 hover:shadow-lg hover:shadow-electric-blue/30 transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:pointer-events-none"
                      >
                        Next: Branch & City
                        <ChevronRight
                          size={16}
                          className="group-hover:translate-x-1 transition-transform"
                        />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                          Multi-Branch, Multi-City &amp; Round Preferences
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Select one or multiple engineering branches and cities
                          below — or leave empty to evaluate{" "}
                          <strong className="text-slate-800">All</strong>{" "}
                          matching colleges across Maharashtra.
                        </p>
                      </div>

                      {/* Multi-Branch Selection */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="branch-select"
                              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                            >
                              Preferred Engineering Branches
                            </label>
                            <span className="font-mono tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded-md bg-electric-blue/10 text-electric-blue">
                              {form.branches.length === 0
                                ? "All Branches"
                                : `${form.branches.length} Selected`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  branches: CS_IT_AI_BUNDLE.filter((b) =>
                                    filters.branches.length
                                      ? filters.branches.includes(b)
                                      : true
                                  ),
                                }))
                              }
                              className="text-[11px] font-semibold text-electric-blue hover:bg-electric-blue/10 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                              + CS / IT / AI Bundle
                            </button>
                            {form.branches.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((prev) => ({ ...prev, branches: [] }))
                                }
                                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Toggleable Popular Branch Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, branches: [] }))
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                              form.branches.length === 0
                                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90"
                            }`}
                          >
                            {form.branches.length === 0 && <Check size={12} />}
                            All Branches
                          </button>
                          {POPULAR_BRANCHES.map((b) => {
                            const active = form.branches.includes(b.value);
                            return (
                              <button
                                key={b.value}
                                type="button"
                                onClick={() => toggleBranch(b.value)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                  active
                                    ? "bg-electric-blue text-white border-electric-blue shadow-2xs"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90"
                                }`}
                              >
                                {active && <Check size={12} />}
                                {b.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Add Any Other Branch Dropdown */}
                        <div className="relative">
                          <BookOpen
                            size={16}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          />
                          <select
                            id="branch-select"
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !form.branches.includes(val)) {
                                setForm((prev) => ({
                                  ...prev,
                                  branches: [...prev.branches, val],
                                }));
                              }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:ring-4 focus:ring-electric-blue/15 focus:border-electric-blue transition-all font-medium text-slate-700 text-xs sm:text-sm"
                          >
                            <option value="">
                              + Add more branches from all{" "}
                              {filters.branches.length || 60}+ courses...
                            </option>
                            {filters.branches
                              .filter((b) => !form.branches.includes(b))
                              .map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Selected Branches Removable Pill Strip (especially helpful for dropdown-added branches) */}
                        {form.branches.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-blue-50/50 border border-blue-200/70">
                            {form.branches.map((b) => (
                              <span
                                key={b}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-electric-blue/30 text-electric-blue text-xs font-semibold shadow-2xs"
                              >
                                {b}
                                <button
                                  type="button"
                                  onClick={() => toggleBranch(b)}
                                  className="hover:text-rose-600 cursor-pointer"
                                  aria-label={`Remove ${b}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Multi-City Selection */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor="city-select"
                              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                            >
                              Preferred Cities / Regions
                            </label>
                            <span className="font-mono tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {form.cities.length === 0
                                ? "All Maharashtra"
                                : `${form.cities.length} Selected`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  cities: PUNE_MUMBAI_BUNDLE,
                                }))
                              }
                              className="text-[11px] font-semibold text-electric-blue hover:bg-electric-blue/10 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                              + Pune &amp; Mumbai Region
                            </button>
                            {form.cities.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((prev) => ({ ...prev, cities: [] }))
                                }
                                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Toggleable Popular City Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({ ...prev, cities: [] }))
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                              form.cities.length === 0
                                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90"
                            }`}
                          >
                            {form.cities.length === 0 && <Check size={12} />}
                            All Cities
                          </button>
                          {POPULAR_CITIES.map((c) => {
                            const active = form.cities.includes(c.value);
                            return (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => toggleCity(c.value)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                  active
                                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/90"
                                }`}
                              >
                                {active && <Check size={12} />}
                                {c.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="relative">
                            <MapPin
                              size={16}
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                            <select
                              id="city-select"
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val && !form.cities.includes(val)) {
                                  setForm((prev) => ({
                                    ...prev,
                                    cities: [...prev.cities, val],
                                  }));
                                }
                              }}
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:ring-4 focus:ring-electric-blue/15 focus:border-electric-blue transition-all font-medium text-slate-700 text-xs sm:text-sm"
                            >
                              <option value="">
                                + Add another Maharashtra city...
                              </option>
                              {filters.cities
                                .filter((c) => !form.cities.includes(c))
                                .map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <select
                              aria-label="Target CAP Round"
                              value={form.round}
                              onChange={(e) =>
                                setForm({ ...form, round: e.target.value })
                              }
                              className="w-full px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:ring-4 focus:ring-electric-blue/15 focus:border-electric-blue transition-all font-medium text-slate-900 text-xs sm:text-sm"
                            >
                              <option value="All">
                                All Rounds (Closing Cutoff)
                              </option>
                              <option value="1">CAP Round 1 Only</option>
                              <option value="2">CAP Round 2 Only</option>
                              <option value="3">CAP Round 3 Only</option>
                            </select>
                          </div>
                        </div>

                        {/* Selected Cities Removable Pill Strip */}
                        {form.cities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90">
                            {form.cities.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold shadow-2xs"
                              >
                                <MapPin size={11} className="text-electric-blue" />
                                {c}
                                <button
                                  type="button"
                                  onClick={() => toggleCity(c)}
                                  className="hover:text-rose-600 cursor-pointer"
                                  aria-label={`Remove ${c}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sticky Action Footer for Step 3 */}
                    <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-5 mt-6 border-t border-slate-200/80 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        &larr; Back to Score
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredict()}
                        disabled={loading}
                        className="group bg-electric-blue hover:bg-blue-600 text-white font-semibold px-7 py-3 rounded-xl shadow-md shadow-electric-blue/25 hover:shadow-lg hover:shadow-electric-blue/35 transition-all flex items-center gap-2 text-sm cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCw className="animate-spin" size={17} />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        {loading ? "Analyzing Cutoffs..." : "Reveal Colleges"}
                        <ArrowRight
                          size={16}
                          className="group-hover:translate-x-1 transition-transform"
                        />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {/* STEP 4: RESULTS DASHBOARD */}
      {step === 4 && (
        <section className="py-8 px-6 max-w-7xl mx-auto w-full flex-1">
          {/* Top Summary & Quick-Tune Bar */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs mb-6 space-y-4 print:border-none print:p-0 print:mb-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-electric-blue uppercase tracking-wider bg-electric-blue/10 px-2.5 py-1 rounded-md">
                    Your 2025 CAP Equivalent Profile
                  </span>
                  {studentInfo && (
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                      <span>
                        {Number(
                          studentInfo.percentile ??
                            studentInfo.student_percentile ??
                            0
                        ).toFixed(2)}{" "}
                        %ile
                      </span>
                      <span className="text-slate-400">&harr;</span>
                      <span className="text-electric-blue">
                        State Merit Rank #
                        {Number(
                          studentInfo.rank ?? studentInfo.student_rank ?? 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                    Category: {formatCategory(form.category)}
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2 pt-1">
                  Category Rank & Percentile Predictions (
                  {basePredictions.length} Courses)
                  {loading && (
                    <RefreshCw
                      size={18}
                      className="animate-spin text-electric-blue"
                    />
                  )}
                </h2>
                {fallbackUsed && (
                  <p className="text-xs text-amber-600">
                    No courses were directly within range for this score;
                    showing the closest reachable options with exact rank &
                    percentile margins.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <Link
                  href={`/option-form?${buildCrossToolQuery()}`}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-electric-blue hover:bg-blue-600 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ListOrdered size={14} /> Build Option Form
                </Link>
                <Link
                  href={`/what-if?${buildCrossToolQuery()}`}
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Activity size={14} /> What-If
                </Link>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedShare ? (
                    <>
                      <Check size={14} className="text-emerald-600" /> Link Copied!
                    </>
                  ) : (
                    <>
                      <Share2 size={14} className="text-electric-blue" /> Share Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} /> Wizard
                </button>
                <button
                  type="button"
                  onClick={exportCSV}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {!proActive && <Lock size={12} className="text-amber-600" />}
                  <FileSpreadsheet size={14} className="text-emerald-600" />{" "}
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!proActive) {
                      openUpgradeModal(
                        "pro",
                        "Print & save your complete college prediction sheet as PDF with CAP Pro Pass"
                      );
                      return;
                    }
                    window.print();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  {!proActive && <Lock size={12} className="text-amber-400" />}
                  <Download size={14} /> Print / PDF
                </button>
              </div>
            </div>

            {/* Inline Quick-Switch Controls Bar */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
              {/* Inline Score Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      inputType:
                        prev.inputType === "percentile" ? "rank" : "percentile",
                      percentile:
                        prev.inputType === "rank" && studentInfo
                          ? String(
                              Number(
                                studentInfo.percentile ??
                                  studentInfo.student_percentile ??
                                  0
                              ).toFixed(2)
                            )
                          : prev.percentile,
                      rank:
                        prev.inputType === "percentile" && studentInfo
                          ? String(
                              studentInfo.rank ?? studentInfo.student_rank ?? ""
                            )
                          : prev.rank,
                    }))
                  }
                  className="px-2 py-1.5 bg-white text-slate-900 rounded-lg text-[11px] font-mono tabular-nums font-bold border border-slate-200/80 shrink-0 cursor-pointer"
                  title="Click to toggle between Percentile and Rank input"
                >
                  {form.inputType === "percentile" ? "%ile" : "Rank #"}
                </button>
                <input
                  type="number"
                  step={form.inputType === "percentile" ? "0.01" : "1"}
                  value={
                    form.inputType === "percentile"
                      ? form.percentile
                      : form.rank
                  }
                  onChange={(e) =>
                    setForm((prev) =>
                      prev.inputType === "percentile"
                        ? { ...prev, percentile: e.target.value }
                        : { ...prev, rank: e.target.value }
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isScoreValid) handlePredict();
                  }}
                  placeholder={
                    form.inputType === "percentile" ? "96.45" : "12500"
                  }
                  className="w-full bg-transparent text-xs font-mono tabular-nums font-bold text-slate-900 px-1.5 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!isScoreValid || loading}
                  onClick={() => handlePredict()}
                  className="px-2.5 py-1.5 bg-electric-blue text-white rounded-lg text-[11px] font-bold hover:bg-blue-600 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  Go
                </button>
              </div>

              {/* Category Quick Switcher */}
              <select
                aria-label="Quick switch reservation category"
                value={form.category}
                disabled={loading}
                onChange={(e) => {
                  const nextCat = e.target.value;
                  setForm((prev) => ({ ...prev, category: nextCat }));
                  handlePredict({ category: nextCat });
                }}
                className="text-xs text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
              >
                {renderGroupedCategoryOptions()}
              </select>

              {/* Add Branch Quick Switcher (Multi-Branch) */}
              <select
                aria-label="Add engineering branch filter"
                value=""
                disabled={loading}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__CLEAR__") {
                    setForm((prev) => ({ ...prev, branches: [] }));
                    handlePredict({ branches: [] });
                  } else if (val && !form.branches.includes(val)) {
                    const nextBranches = [...form.branches, val];
                    setForm((prev) => ({ ...prev, branches: nextBranches }));
                    handlePredict({ branches: nextBranches });
                  }
                }}
                className="text-xs text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
              >
                <option value="">
                  {form.branches.length === 0
                    ? "+ Filter Branches (All)"
                    : `+ Add Branch (${form.branches.length} active)`}
                </option>
                {form.branches.length > 0 && (
                  <option value="__CLEAR__">↺ Reset to All Branches</option>
                )}
                {filters.branches
                  .filter((b) => !form.branches.includes(b))
                  .map((b) => (
                    <option key={b} value={b}>
                      + {b}
                    </option>
                  ))}
              </select>

              {/* Add City Quick Switcher (Multi-City) */}
              <select
                aria-label="Add city filter"
                value=""
                disabled={loading}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__CLEAR__") {
                    setForm((prev) => ({ ...prev, cities: [] }));
                    handlePredict({ cities: [] });
                  } else if (val && !form.cities.includes(val)) {
                    const nextCities = [...form.cities, val];
                    setForm((prev) => ({ ...prev, cities: nextCities }));
                    handlePredict({ cities: nextCities });
                  }
                }}
                className="text-xs text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
              >
                <option value="">
                  {form.cities.length === 0
                    ? "+ Filter Cities (All MH)"
                    : `+ Add City (${form.cities.length} active)`}
                </option>
                {form.cities.length > 0 && (
                  <option value="__CLEAR__">↺ Reset to All Cities</option>
                )}
                {filters.cities
                  .filter((c) => !form.cities.includes(c))
                  .map((c) => (
                    <option key={c} value={c}>
                      + {c}
                    </option>
                  ))}
              </select>

              {/* CAP Round Quick Switcher */}
              <select
                aria-label="Quick switch CAP round"
                value={form.round}
                disabled={loading}
                onChange={(e) => {
                  const nextRound = e.target.value;
                  setForm((prev) => ({ ...prev, round: nextRound }));
                  handlePredict({ round: nextRound });
                }}
                className="text-xs text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue"
              >
                <option value="All">All Rounds (Closing Cutoff)</option>
                <option value="1">CAP Round 1</option>
                <option value="2">CAP Round 2</option>
                <option value="3">CAP Round 3</option>
              </select>
            </div>

            {/* Active Multi-Branch & Multi-City Filter Chips Bar */}
            {(form.branches.length > 0 || form.cities.length > 0) && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 print:hidden">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Active Filters:
                </span>
                {form.branches.map((b) => (
                  <span
                    key={`br-${b}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/25 text-electric-blue text-xs font-semibold"
                  >
                    <BookOpen size={11} />
                    {b}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const nextBranches = form.branches.filter((x) => x !== b);
                        setForm((prev) => ({ ...prev, branches: nextBranches }));
                        handlePredict({ branches: nextBranches });
                      }}
                      className="hover:text-rose-600 cursor-pointer"
                      aria-label={`Remove branch ${b}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {form.cities.map((c) => (
                  <span
                    key={`ct-${c}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold"
                  >
                    <MapPin size={11} className="text-teal-300" />
                    {c}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const nextCities = form.cities.filter((x) => x !== c);
                        setForm((prev) => ({ ...prev, cities: nextCities }));
                        handlePredict({ cities: nextCities });
                      }}
                      className="hover:text-rose-300 cursor-pointer"
                      aria-label={`Remove city ${c}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, branches: [], cities: [] }));
                    handlePredict({ branches: [], cities: [] });
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline ml-auto cursor-pointer"
                >
                  Clear All Branch &amp; City Filters
                </button>
              </div>
            )}
          </div>

          {/* Interactive Band Filter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
            <button
              type="button"
              onClick={() =>
                setBandFilter(
                  bandFilter === "Historically Within Range"
                    ? "All"
                    : "Historically Within Range"
                )
              }
              className={`bg-white p-5 rounded-2xl border text-left transition-all flex items-center gap-4 cursor-pointer ${
                bandFilter === "Historically Within Range"
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                  : "border-slate-200/90 hover:border-emerald-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {counts.within}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Historically Within Range
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(bandFilter === "Moderate" ? "All" : "Moderate")
              }
              className={`bg-white p-5 rounded-2xl border text-left transition-all flex items-center gap-4 cursor-pointer ${
                bandFilter === "Moderate"
                  ? "border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                  : "border-slate-200/90 hover:border-amber-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {counts.mod}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Moderate Options
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(bandFilter === "Ambitious" ? "All" : "Ambitious")
              }
              className={`bg-white p-5 rounded-2xl border text-left transition-all flex items-center gap-4 cursor-pointer ${
                bandFilter === "Ambitious"
                  ? "border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                  : "border-slate-200/90 hover:border-rose-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <TrendingUp size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {counts.amb}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Ambitious Options
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBandFilter(
                  bandFilter === "Bookmarked" ? "All" : "Bookmarked"
                )
              }
              className={`bg-white p-5 rounded-2xl border text-left transition-all flex items-center gap-4 cursor-pointer ${
                bandFilter === "Bookmarked"
                  ? "border-electric-blue ring-2 ring-electric-blue/20 shadow-xs"
                  : "border-slate-200/90 hover:border-electric-blue/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-electric-blue/10 text-electric-blue flex items-center justify-center shrink-0">
                <Bookmark size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {counts.saved}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Bookmarked in Results
                </div>
              </div>
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 print:hidden">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Filter results by college name, DTE code, branch, or city..."
                value={resultSearch}
                onChange={(e) => {
                  setResultSearch(e.target.value);
                  setVisibleCount(30);
                }}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-electric-blue focus:bg-white transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {bandFilter !== "All" && (
                <button
                  type="button"
                  onClick={() => setBandFilter("All")}
                  className="text-xs font-semibold text-electric-blue hover:underline cursor-pointer"
                >
                  Reset Band ({bandFilter})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setExactOnly((prev) => !prev);
                  setVisibleCount(30);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  exactOnly
                    ? "bg-electric-blue text-white border-electric-blue"
                    : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                }`}
                title="Toggle between showing only direct reported category cutoffs vs including calibrated category estimates"
              >
                {exactOnly
                  ? `Direct ${form.category} Seats Only`
                  : "Direct + Calibrated Seats"}
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <SlidersHorizontal size={14} />
                <span className="font-semibold">Sort:</span>
                <select
                  value={resultSort}
                  onChange={(e) => setResultSort(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none"
                >
                  <option value="best_match">
                    Best Match (Within Range + Top Cutoff)
                  </option>
                  <option value="cutoff_desc">
                    Percentile Cutoff (Highest First)
                  </option>
                  <option value="rank_asc">
                    Merit Rank Cutoff (Best Rank First)
                  </option>
                  <option value="margin_desc">
                    Safety Margin (Safest First)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Results List */}
          {filteredPredictions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                No Matching Colleges Found
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Try clearing the search/band filter or broadening your branch and
                city preferences.
              </p>
              <div className="flex justify-center gap-3">
                {bandFilter !== "All" || resultSearch || exactOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBandFilter("All");
                      setResultSearch("");
                      setExactOnly(false);
                    }}
                    className="bg-electric-blue text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="bg-electric-blue text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Change Preferences
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {filteredPredictions
                  .slice(
                    0,
                    proActive
                      ? visibleCount
                      : Math.min(visibleCount, FREE_PREDICTION_LIMIT)
                  )
                  .map((p, idx) => {
                  let badgeColor =
                    "bg-rose-500/10 text-rose-700 border-rose-500/20";
                  if (
                    p.prediction_category === "Historically Within Range"
                  ) {
                    badgeColor =
                      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
                  } else if (p.prediction_category === "Moderate") {
                    badgeColor =
                      "bg-amber-500/10 text-amber-700 border-amber-500/20";
                  }

                  const isSaved = bookmarkedKeys.has(
                    `${p.college_code}|${p.branch}`
                  );

                  const marginPct =
                    p.margin_percentile ??
                    (form.inputType === "percentile" ? p.margin : 0);
                  const marginRank =
                    p.margin_rank ??
                    (form.inputType === "rank" ? p.margin : 0);

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.2) }}
                      key={`${p.college_code}-${p.branch}-${idx}`}
                      className="bg-white rounded-2xl p-6 border border-slate-200/90 hover:border-electric-blue/40 shadow-2xs hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
                    >
                      {/* Left Column: College, Branch & 3-Year Category History */}
                      <div className="space-y-2.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${badgeColor}`}
                          >
                            {p.prediction_category}
                          </span>
                          {p.chance_level && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {p.chance_level} Chance
                            </span>
                          )}
                          <span className="text-xs font-mono tabular-nums text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            DTE: {p.college_code}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={12} className="text-electric-blue" />{" "}
                            {p.city}
                          </span>
                          {p.is_estimate ? (
                            <span
                              className="text-[10px] font-mono tabular-nums text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-semibold"
                              title={`Calibrated for ${form.category} from ${p.basis_category} (${
                                p.raw_percentile != null
                                  ? `${p.raw_percentile.toFixed(2)}%ile`
                                  : `Rank ${p.raw_rank}`
                              })`}
                            >
                              Calibrated ({p.basis_category} &rarr;{" "}
                              {form.category})
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono tabular-nums text-electric-blue bg-electric-blue/10 border border-electric-blue/20 px-2 py-0.5 rounded font-semibold">
                              Direct Seat ({p.basis_category})
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 leading-snug">
                          <Link
                            href={`/college/${p.college_code}`}
                            className="hover:text-electric-blue transition-colors"
                          >
                            {p.college_name}
                          </Link>
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <div className="text-sm font-semibold text-electric-blue flex items-center gap-2">
                            <GraduationCap size={16} /> {p.branch}
                          </div>
                          {(p.official_website || p.cet_portal_url) && (
                            <a
                              href={p.official_website || p.cet_portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-600 hover:text-electric-blue bg-slate-50 hover:bg-electric-blue/5 border border-slate-200/80 hover:border-electric-blue/30 px-2 py-0.5 rounded-md transition-colors print:hidden"
                            >
                              <Globe size={11} className="text-electric-blue" />
                              {p.website_domain || "CET Official Profile"}
                              <ExternalLink size={10} className="opacity-70" />
                            </a>
                          )}
                          {p.nirf_median_lpa != null && (
                            <Link
                              href={`/college/${p.college_code}`}
                              title="Verified NIRF UG Median Salary & Official T&P Placement Report"
                              className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                            >
                              NIRF Median: ₹{Number(p.nirf_median_lpa).toFixed(1)}L
                            </Link>
                          )}
                          {p.annual_fee_inr != null && (
                            <Link
                              href={`/college/${p.college_code}`}
                              title={
                                p.fee_source_type === "FRA"
                                  ? "Approved Annual Open Fee (Maharashtra FRA)"
                                  : "Official Annual Open Fee (Govt./Institute Circular)"
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                            >
                              Fee: ₹{(p.annual_fee_inr / 100000).toFixed(2)}L/yr
                            </Link>
                          )}
                        </div>

                        {/* 3-Year Category Cutoff History Pills */}
                        {Array.isArray(p.history) && p.history.length > 0 && (
                          <div className="pt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {form.category} History:
                            </span>
                            {p.history.map((h: any) => (
                              <span
                                key={h.year}
                                className="text-[11px] font-mono tabular-nums bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded text-slate-800"
                              >
                                <strong>{h.year}:</strong>{" "}
                                {Number(h.percentile).toFixed(2)}%{" "}
                                <span className="text-slate-500">
                                  (#{Number(h.rank).toLocaleString()})
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right Column: Dual Category Cutoffs (Percentile + Rankwise) & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-200/80">
                        {/* Side-by-Side Category Percentile & Rankwise Cutoff Boxes */}
                        <div className="grid grid-cols-2 gap-3 flex-1 sm:flex-initial">
                          {/* Box 1: Category Percentile Cutoff */}
                          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl px-4 py-2.5 text-left sm:text-right min-w-[148px]">
                            <div className="text-[10px] font-mono tabular-nums font-bold uppercase tracking-wider text-slate-500">
                              {form.category} %ile ({p.year} R{p.round})
                            </div>
                            <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
                              {p.historical_percentile != null
                                ? `${p.historical_percentile.toFixed(2)} %`
                                : "N/A"}
                            </div>
                            <div
                              className={`text-[11px] font-mono tabular-nums font-semibold mt-0.5 ${
                                marginPct >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {marginPct >= 0 ? "+" : ""}
                              {Number(marginPct || 0).toFixed(2)} %ile margin
                            </div>
                          </div>

                          {/* Box 2: Category Rankwise Cutoff */}
                          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl px-4 py-2.5 text-left sm:text-right min-w-[155px]">
                            <div className="text-[10px] font-mono tabular-nums font-bold uppercase tracking-wider text-slate-500">
                              {form.category} Merit Rank
                            </div>
                            <div className="text-lg font-extrabold font-mono tabular-nums text-electric-blue mt-0.5">
                              #
                              {Math.round(
                                p.historical_rank || 0
                              ).toLocaleString()}
                            </div>
                            <div
                              className={`text-[11px] font-mono tabular-nums font-semibold mt-0.5 ${
                                marginRank >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {marginRank >= 0 ? "+" : ""}
                              {Math.round(marginRank || 0).toLocaleString()}{" "}
                              ranks
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 print:hidden">
                          <button
                            type="button"
                            onClick={() => toggleBookmark(p)}
                            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                              isSaved
                                ? "text-electric-blue bg-electric-blue/10 border-electric-blue/30"
                                : "text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-200"
                            }`}
                            title={
                              isSaved
                                ? "Remove from Shortlist"
                                : "Save to Shortlist"
                            }
                          >
                            <Bookmark
                              size={16}
                              className={isSaved ? "fill-electric-blue" : ""}
                            />
                          </button>
                          <Link
                            href={`/analytics?college=${p.college_code}&branch=${encodeURIComponent(
                              p.branch
                            )}&category=${encodeURIComponent(form.category)}`}
                            className="px-3.5 py-2.5 text-xs font-semibold text-electric-blue bg-electric-blue/10 hover:bg-electric-blue/20 rounded-xl transition-colors"
                          >
                            Trends
                          </Link>
                          <Link
                            href={`/college/${p.college_code}`}
                            className="px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                          >
                            Cutoffs
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {!proActive && filteredPredictions.length > FREE_PREDICTION_LIMIT && (
                <div className="mt-8 bg-gradient-to-br from-[#0B1120] to-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-xl text-center space-y-4 print:hidden">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-teal-300 text-xs font-bold">
                    <Lock size={13} />{" "}
                    {filteredPredictions.length - FREE_PREDICTION_LIMIT} More
                    Matching Courses Ready for Your Score
                  </div>
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    Unlock All {filteredPredictions.length} Category Rank &amp;
                    Percentile Matches
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                    Upgrade to <strong>CAP Pro Pass</strong> for a one-time fee
                    of <strong className="font-mono text-white">₹199</strong>{" "}
                    via Google Pay (
                    <strong className="font-mono text-white">
                      {GPAY_NUMBER}
                    </strong>
                    ) to unlock every matching institute, build your 60-choice
                    DTE Option Form, and export unlimited CSV/PDF sheets.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        openUpgradeModal(
                          "pro",
                          `Unlock all ${filteredPredictions.length} matching courses for ${form.category}`
                        )
                      }
                      className="bg-electric-blue hover:bg-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-electric-blue/30 inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Crown size={16} /> Unlock CAP Pro Pass — ₹199 (GPay{" "}
                      {GPAY_NUMBER})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openUpgradeModal(
                          "vip",
                          "Get 1-on-1 personal CAP counselling + Option Form review"
                        )
                      }
                      className="bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm px-5 py-3.5 rounded-xl cursor-pointer"
                    >
                      VIP + 1-on-1 Review (₹499)
                    </button>
                  </div>
                </div>
              )}

              {proActive && visibleCount < filteredPredictions.length && (
                <div className="mt-8 text-center print:hidden">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 40)}
                    className="bg-white hover:bg-slate-50 text-slate-900 font-semibold px-6 py-3 rounded-xl border border-slate-200 shadow-2xs transition-all text-sm cursor-pointer"
                  >
                    Load More ({filteredPredictions.length - visibleCount}{" "}
                    remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Mandatory Disclaimer */}
          <div className="mt-12 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3 text-xs text-slate-600">
            <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900">
                Important Disclaimer:
              </span>{" "}
              This classification is strictly based on historical MHT-CET CAP
              cutoff data (2023–2025) and is not a guaranteed admission
              probability. Both Category Percentile and State Merit Rank cutoffs
              are normalized to the 2025 CAP merit pool scale (~3.19 lakh
              candidates). Entries marked <strong>Calibrated</strong> use
              empirical category offsets where the exact category had no direct
              row in that round.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
