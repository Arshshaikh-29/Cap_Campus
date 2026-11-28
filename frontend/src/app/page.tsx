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
  Radar,
  Wallet,
  Copy,
  Layers,
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
  const [copiedChoice, setCopiedChoice] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/filters`)
      .then((res) => setFilters(res.data))
      .catch(() => undefined);

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
          round: rdParam && ["1", "2", "3", "4"].includes(rdParam) ? rdParam : "All",
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
    } catch {
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
      "Category_Rank_Cutoff_2026_Scale",
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
        <section className="py-10 sm:py-14 lg:py-16 flex-1 flex flex-col">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#4F46E5]/20 text-[#4F46E5] text-xs font-semibold">
                MHT-CET 2023–2026 • Rounds 1–4
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-[#172554] leading-[1.08]">
                Navigate CAP Admissions with{" "}
                <span className="text-[#4F46E5]">Clarity.</span>
              </h1>

              <p className="text-base sm:text-lg text-[#64748B] max-w-xl leading-relaxed">
                Predict Maharashtra engineering colleges by category rank,
                percentile, branch, and city.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  onClick={() => setStep(2)}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-6 py-3.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 text-sm sm:text-base group cursor-pointer"
                >
                  Predict My Colleges
                  <ArrowRight
                    size={17}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
                <Link
                  href="/map"
                  className="bg-white hover:bg-[#F8FAFC] text-[#172554] border border-[#E2E8F0] font-semibold px-6 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <MapPin size={16} className="text-[#4F46E5]" />
                  College Map
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#E2E8F0]">
                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[#172554]">
                    198k+
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    Cutoff Records
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[#172554]">
                    400
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    Colleges
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-[#172554]">
                    R1 – R4
                  </div>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    2023–2026 Data
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3.5 mb-4">
                  <div className="text-sm font-bold text-[#172554]">
                    Top 2026 Cutoffs (GOPENS)
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      name: "VJTI Mumbai",
                      code: "3012",
                      branch: "Computer Engineering",
                      cutoff: "99.99%",
                      rank: "#71",
                    },
                    {
                      name: "COEP Tech University, Pune",
                      code: "6006",
                      branch: "Computer Science & Engg",
                      cutoff: "99.98%",
                      rank: "#150",
                    },
                    {
                      name: "SPIT Andheri, Mumbai",
                      code: "3215",
                      branch: "Computer Science & Engg",
                      cutoff: "99.88%",
                      rank: "#537",
                    },
                    {
                      name: "PICT Pune",
                      code: "6271",
                      branch: "Computer Engineering",
                      cutoff: "99.79%",
                      rank: "#929",
                    },
                  ].map((item, i) => (
                    <Link
                      key={i}
                      href={`/college/${item.code}`}
                      className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#4F46E5]/40 hover:bg-white transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#172554] text-sm truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#64748B] truncate">
                          {item.branch}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs shrink-0">
                        <div className="font-bold text-[#172554]">{item.cutoff}</div>
                        <div className="text-[#4F46E5] font-semibold">{item.rank}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 pt-3.5 border-t border-[#E2E8F0] flex justify-between items-center text-xs text-[#64748B]">
                  <span>DTE Maharashtra Cutoffs</span>
                  <button
                    onClick={() => setStep(2)}
                    className="text-[#4F46E5] font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    Check your score <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Clean Quick Tools Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-14 space-y-6 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#172554]">Counselling Tools</h2>
              <Link
                href="/explorer"
                className="text-xs font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1"
              >
                All 400 Colleges <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: ListOrdered,
                  badge: "PRO",
                  title: "Option Form & Auditor",
                  desc: "Dream → Safe list, blunder check & TFWS codes.",
                  href: "/option-form",
                },
                {
                  icon: Layers,
                  badge: "PRO",
                  title: "Quota & TFWS Unlocker",
                  desc: "Home Univ (70%), Ladies (30%) & ₹0 tuition seats.",
                  href: "/quota-optimizer",
                },
                {
                  icon: Radar,
                  badge: "PRO",
                  title: "Betterment Radar",
                  desc: "Round 1 to Round 4 cutoff drops.",
                  href: "/betterment",
                },
                {
                  icon: Wallet,
                  badge: "PRO",
                  title: "ROI & Net Fees",
                  desc: "MahaDBT fee waivers vs NIRF salary.",
                  href: "/roi-finder",
                },
                {
                  icon: Activity,
                  badge: null,
                  title: "What-If Simulator",
                  desc: "Check ±2%ile impact on reachability.",
                  href: "/what-if",
                },
                {
                  icon: BarChart3,
                  badge: null,
                  title: "Cutoff Analytics",
                  desc: "Multi-year 2023–2026 trend charts.",
                  href: "/analytics",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#4F46E5]/40 transition-all flex items-start gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0 group-hover:bg-[#4F46E5] group-hover:text-white transition-colors">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#172554]">
                          {card.title}
                        </h3>
                        {card.badge && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5]">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">{card.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Compact Pro Strip */}
            <div className="bg-[#172554] text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-base font-bold">
                  Unlock CAP Pro — ₹199 one-time
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  60-choice Option Form &amp; Mistake Auditor, Quota/TFWS Unlocker, Betterment Radar &amp; CSV/PDF exports.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openUpgradeModal("pro")}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Unlock Pro
                </button>
                <Link
                  href="/pricing"
                  className="bg-white/10 hover:bg-white/15 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2 & 3: MODERN SAAS SPLIT-CARD ADMISSION WIZARD */}
      {(step === 2 || step === 3) && (
        <section className="py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl border border-[#E2E8F0] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.08),0_4px_16px_-4px_rgba(15,23,42,0.04)] overflow-hidden min-h-[620px]">
            {/* Left Stepper Panel */}
            <div className="md:col-span-4 bg-[#172554] text-white p-7 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#C7D2FE] mb-3">
                  Predictor Wizard
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white leading-snug">
                  Enter your score &amp; preferences
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
                              ? "bg-electric-blue text-white ring-4 ring-electric-blue/30 shadow-[0_0_16px_rgba(79,70,229,0.6)]"
                              : isCompleted
                              ? "bg-teal-500/20 border border-teal-400/50 text-[#C7D2FE]"
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
                      pill: "bg-blue-500/20 text-[#C7D2FE] border-blue-400/30",
                    },
                    {
                      code: "H",
                      title: "Home University",
                      meta: "Local Univ. Jurisdiction",
                      pill: "bg-teal-500/20 text-[#C7D2FE] border-teal-400/30",
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
                        <h3 className="text-xl font-bold tracking-tight text-[#172554]">
                          Score &amp; Category
                        </h3>
                      </div>

                      {/* Score Input Mode Segmented Toggle */}
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Score Input Mode
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-[#E2E8F0] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ ...form, inputType: "percentile" })
                            }
                            className={`py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              form.inputType === "percentile"
                                ? "bg-white text-[#172554] font-semibold shadow-xs ring-1 ring-slate-900/5"
                                : "text-slate-600 hover:text-[#172554] font-medium"
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
                                ? "bg-white text-[#172554] font-semibold shadow-xs ring-1 ring-slate-900/5"
                                : "text-slate-600 hover:text-[#172554] font-medium"
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
                              className="w-full text-2xl font-mono tabular-nums font-bold text-[#172554] placeholder:text-slate-300 placeholder:font-medium pl-4 pr-20 py-3.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-[#E2E8F0] text-slate-600 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg select-none pointer-events-none">
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
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-[#172554] border-[#E2E8F0] font-medium"
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
                              <div className="p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-700">
                                  <ArrowLeftRight
                                    size={14}
                                    className="text-electric-blue shrink-0"
                                  />
                                  <span>
                                    {conversionPreview.latest_year || 2026} State Merit Rank:{" "}
                                    <strong className="font-mono tabular-nums text-electric-blue font-bold">
                                      #
                                      {Number(
                                        conversionPreview.estimated_rank
                                      ).toLocaleString()}
                                    </strong>{" "}
                                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                                      (2025: #
                                      {Number(
                                        conversionPreview.by_year?.["2025"] || 0
                                      ).toLocaleString()}{" "}
                                      • 2024: #
                                      {Number(
                                        conversionPreview.by_year?.["2024"] || 0
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
                              className="w-full text-2xl font-mono tabular-nums font-bold text-[#172554] placeholder:text-slate-300 placeholder:font-medium pl-4 pr-24 py-3.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15 transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 border border-[#E2E8F0] text-slate-600 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg select-none pointer-events-none">
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
                                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-[#172554] border-[#E2E8F0] font-medium"
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
                              <div className="p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-700">
                                  <ArrowLeftRight
                                    size={14}
                                    className="text-electric-blue shrink-0"
                                  />
                                  <span>
                                    {conversionPreview.latest_year || 2026} Equivalent Percentile:{" "}
                                    <strong className="font-mono tabular-nums text-electric-blue font-bold">
                                      {Number(
                                        conversionPreview.estimated_percentile
                                      ).toFixed(2)}{" "}
                                      %ile
                                    </strong>{" "}
                                    <span className="text-slate-500 font-mono tabular-nums text-[11px]">
                                      (2025:{" "}
                                      {Number(
                                        conversionPreview.by_year?.["2025"] || 0
                                      ).toFixed(2)}
                                      % • 2024:{" "}
                                      {Number(
                                        conversionPreview.by_year?.["2024"] || 0
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
                                    : "bg-white hover:bg-slate-50/90 border-[#E2E8F0] hover:border-slate-300 shadow-2xs"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={`text-sm font-bold tracking-tight ${
                                      active
                                        ? "text-electric-blue"
                                        : "text-[#172554]"
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
                                        : "bg-slate-100 text-slate-600 border-[#E2E8F0]"
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
                              : "bg-slate-50/90 border-[#E2E8F0]"
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
                              className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white border border-[#E2E8F0] hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/15 cursor-pointer truncate"
                            >
                              {renderGroupedCategoryOptions()}
                            </select>
                            <ChevronDown
                              size={14}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Sticky Action Footer (Back hidden on Step 2; two right-aligned primary actions) */}
                    <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-5 mt-6 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
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
                        className="group bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none text-white border border-electric-blue font-semibold px-6 py-3 rounded-xl shadow-md shadow-electric-blue/20 hover:shadow-lg hover:shadow-electric-blue/30 transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer disabled:pointer-events-none"
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
                        <h3 className="text-xl font-bold tracking-tight text-[#172554]">
                          Branch, City &amp; Round
                        </h3>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          Leave empty to search all Maharashtra.
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
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#E2E8F0]"
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
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#E2E8F0]"
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
                          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-blue-50/50 border border-[#4F46E5]/20/70">
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
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#E2E8F0]"
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
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#E2E8F0]"
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
                              className="w-full px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl shadow-2xs focus:outline-none focus:ring-4 focus:ring-electric-blue/15 focus:border-electric-blue transition-all font-medium text-[#172554] text-xs sm:text-sm"
                            >
                              <option value="All">
                                All Rounds (Closing Cutoff)
                              </option>
                              <option value="1">CAP Round 1 Only</option>
                              <option value="2">CAP Round 2 Only</option>
                              <option value="3">CAP Round 3 Only</option>
                              <option value="4">CAP Round 4 Only</option>
                            </select>
                          </div>
                        </div>

                        {/* Selected Cities Removable Pill Strip */}
                        {form.cities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-[#E2E8F0]">
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
                    <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-5 mt-6 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-[#172554] hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        &larr; Back to Score
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePredict()}
                        disabled={loading}
                        className="group bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-7 py-3 rounded-xl shadow-md shadow-electric-blue/25 hover:shadow-lg hover:shadow-electric-blue/35 transition-all flex items-center gap-2 text-sm cursor-pointer"
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
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs mb-6 space-y-4 print:border-none print:p-0 print:mb-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-electric-blue uppercase tracking-wider bg-electric-blue/10 px-2.5 py-1 rounded-md">
                    Your {studentInfo?.rank_scale_year || 2026} CAP Equivalent Profile
                  </span>
                  {studentInfo && (
                    <div className="flex items-center gap-2 text-xs font-mono tabular-nums font-bold text-[#172554] bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
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

                <h2 className="text-2xl font-bold text-[#172554] flex items-center gap-2 pt-1">
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
                  className="px-3.5 py-2 text-xs font-bold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <ListOrdered size={14} /> Build Option Form
                </Link>
                <Link
                  href={`/betterment?${buildCrossToolQuery()}`}
                  className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Radar size={14} /> Betterment Radar
                </Link>
                <Link
                  href={`/what-if?${buildCrossToolQuery()}`}
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Activity size={14} /> What-If
                </Link>
                <Link
                  href={`/map?${buildCrossToolQuery()}`}
                  className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <MapPin size={14} /> View on Map
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
            <div className="pt-4 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
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
                  className="px-2 py-1.5 bg-white text-[#172554] rounded-lg text-[11px] font-mono tabular-nums font-bold border border-[#E2E8F0] shrink-0 cursor-pointer"
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
                  className="w-full bg-transparent text-xs font-mono tabular-nums font-bold text-[#172554] px-1.5 focus:outline-none"
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
                className="text-xs text-[#172554] bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
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
                className="text-xs text-[#172554] bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
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
                className="text-xs text-[#172554] bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue truncate"
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
                className="text-xs text-[#172554] bg-slate-50 hover:bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold cursor-pointer focus:outline-none focus:border-electric-blue"
              >
                <option value="All">All Rounds (Closing Cutoff)</option>
                <option value="1">CAP Round 1</option>
                <option value="2">CAP Round 2</option>
                <option value="3">CAP Round 3</option>
                <option value="4">CAP Round 4</option>
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
                    <MapPin size={11} className="text-[#C7D2FE]" />
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
                  : "border-[#E2E8F0] hover:border-emerald-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#172554]">
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
                  : "border-[#E2E8F0] hover:border-amber-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#172554]">
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
                  : "border-[#E2E8F0] hover:border-rose-500/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <TrendingUp size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#172554]">
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
                  : "border-[#E2E8F0] hover:border-electric-blue/50"
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-electric-blue/10 text-electric-blue flex items-center justify-center shrink-0">
                <Bookmark size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tabular-nums text-[#172554]">
                  {counts.saved}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  Bookmarked in Results
                </div>
              </div>
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 print:hidden">
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
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-[#172554] focus:outline-none"
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
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-lg font-bold text-[#172554]">
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
                      className="bg-white rounded-2xl p-6 border border-[#E2E8F0] hover:border-electric-blue/40 shadow-2xs hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
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
                          {p.choice_code &&
                            (proActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(String(p.choice_code));
                                  setCopiedChoice(String(p.choice_code));
                                  setTimeout(() => setCopiedChoice(null), 1500);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2 py-0.5 rounded border border-[#4F46E5]/20 cursor-pointer"
                                title="Copy official 9-digit DTE Choice Code"
                              >
                                Code: {p.choice_code}
                                {copiedChoice === String(p.choice_code) ? (
                                  <Check size={10} className="text-emerald-600" />
                                ) : (
                                  <Copy size={10} />
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openUpgradeModal(
                                    "pro",
                                    "Unlock official 9-digit DTE Choice Codes & all matching colleges"
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2 py-0.5 rounded border border-[#4F46E5]/20 cursor-pointer"
                                title="Unlock official DTE Choice Code with CAP Pro"
                              >
                                <Lock size={10} /> Code: {String(p.choice_code).slice(0, 4)}•••••
                              </button>
                            ))}
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

                        <h3 className="text-lg font-bold text-[#172554] leading-snug">
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
                              className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-600 hover:text-electric-blue bg-slate-50 hover:bg-electric-blue/5 border border-[#E2E8F0] hover:border-electric-blue/30 px-2 py-0.5 rounded-md transition-colors print:hidden"
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
                                className="text-[11px] font-mono tabular-nums bg-slate-50 border border-[#E2E8F0] px-2 py-0.5 rounded text-slate-800"
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
                      <div className="flex flex-col sm:flex-row lg:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-[#E2E8F0]">
                        {/* Side-by-Side Category Percentile & Rankwise Cutoff Boxes */}
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 flex-1 sm:flex-initial">
                          {/* Box 1: Category Percentile Cutoff */}
                          <div className="bg-slate-50/80 border border-[#E2E8F0] rounded-xl px-3 sm:px-4 py-2.5 text-left sm:text-right min-w-0 sm:min-w-[148px]">
                            <div className="text-[10px] font-mono tabular-nums font-bold uppercase tracking-wider text-slate-500 truncate">
                              {form.category} %ile ({p.year} R{p.round})
                            </div>
                            <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-[#172554] mt-0.5">
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
                          <div className="bg-slate-50/80 border border-[#E2E8F0] rounded-xl px-3 sm:px-4 py-2.5 text-left sm:text-right min-w-0 sm:min-w-[155px]">
                            <div className="text-[10px] font-mono tabular-nums font-bold uppercase tracking-wider text-slate-500 truncate">
                              {form.category} Merit Rank
                            </div>
                            <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-electric-blue mt-0.5">
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
                                : "text-slate-500 hover:text-[#172554] bg-slate-50 hover:bg-slate-100 border-slate-200"
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
                <div className="mt-6 space-y-3 print:hidden">
                  {/* 3 High-Converting Locked Preview Cards */}
                  {filteredPredictions
                    .slice(FREE_PREDICTION_LIMIT, FREE_PREDICTION_LIMIT + 3)
                    .map((lp, lIdx) => (
                      <div
                        key={`locked-pred-${lIdx}`}
                        onClick={() =>
                          openUpgradeModal(
                            "pro",
                            `Unlock all ${filteredPredictions.length} matching courses for ${form.category}`
                          )
                        }
                        className="bg-white/85 hover:bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] hover:border-[#4F46E5]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#4F46E5]">
                              <Lock size={11} /> Match #{FREE_PREDICTION_LIMIT + lIdx + 1} •{" "}
                              {lp.prediction_category}
                            </span>
                            <span className="text-xs font-semibold text-[#172554]">
                              {lp.city} • {lp.branch}
                            </span>
                            {lp.nirf_median_lpa != null && (
                              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                NIRF ₹{Number(lp.nirf_median_lpa).toFixed(1)}L
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-slate-400 select-none blur-[4px]">
                            Locked Maharashtra Engineering Institute • Choice Code 627124510
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#4F46E5] bg-[#EEF2FF] px-3.5 py-2 rounded-xl shrink-0">
                          Unlock Match &rarr;
                        </span>
                      </div>
                    ))}

                  <div className="bg-[#172554] text-white rounded-3xl p-7 sm:p-8 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#C7D2FE] text-xs font-bold">
                      <Lock size={13} /> +
                      {filteredPredictions.length - FREE_PREDICTION_LIMIT} More
                      Matching Courses Locked
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      Unlock All {filteredPredictions.length} Matches &amp; Official Choice Codes
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
                      One-time <strong className="font-mono text-white">₹199</strong> pass (GPay{" "}
                      <strong className="font-mono text-white">{GPAY_NUMBER}</strong>) unlocks all matches, the 60-choice Option Form &amp; Mistake Auditor, Quota/TFWS Unlocker, and CSV/PDF exports.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          openUpgradeModal(
                            "pro",
                            `Unlock all ${filteredPredictions.length} matching courses for ${form.category}`
                          )
                        }
                        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-sm px-7 py-3.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Crown size={16} /> Unlock CAP Pro Pass — ₹199
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
                </div>
              )}

              {proActive && visibleCount < filteredPredictions.length && (
                <div className="mt-8 text-center print:hidden">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 40)}
                    className="bg-white hover:bg-slate-50 text-[#172554] font-semibold px-6 py-3 rounded-xl border border-slate-200 shadow-2xs transition-all text-sm cursor-pointer"
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
              <span className="font-bold text-[#172554]">
                Important Disclaimer:
              </span>{" "}
              This classification is strictly based on historical MHT-CET CAP
              cutoff data (2023–2026, Rounds 1–4) and is not a guaranteed
              admission probability. Both Category Percentile and State Merit
              Rank cutoffs are normalized to the{" "}
              {studentInfo?.rank_scale_year || 2026} CAP merit pool scale.
              Entries marked <strong>Calibrated</strong> use empirical category
              offsets where the exact category had no direct row in that round.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
