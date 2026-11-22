"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  Calculator,
  Compass,
  Crown,
  GitCompare,
  ListOrdered,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface QuickItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  badge?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const STATIC_COMMANDS: QuickItem[] = [
  {
    id: "predictor",
    label: "College Predictor Wizard",
    sublabel: "Multi-branch & multi-city category rank + percentile predictor",
    href: "/?start=1",
    icon: Compass,
  },
  {
    id: "what-if",
    label: "What-If Score Simulator",
    sublabel: "See colleges unlocked at +0.5/+1/+2 %ile or at risk on score drop",
    href: "/what-if",
    badge: "NEW",
    icon: Activity,
  },
  {
    id: "cap-guide",
    label: "CAP Guide & Document Checklist",
    sublabel: "Category-specific document checklist & 7-step CAP counselling guide",
    href: "/cap-guide",
    badge: "NEW",
    icon: BookOpenCheck,
  },
  {
    id: "option-form",
    label: "Smart CAP Option Form Builder",
    sublabel: "Auto-ordered Dream → Target → Safe preference list with DTE codes",
    href: "/option-form",
    badge: "PRO",
    icon: ListOrdered,
  },
  {
    id: "rank-calc",
    label: "Marks & Percentile ↔ Rank Calculator",
    sublabel: "Convert MHT-CET marks/percentile into 2023–2025 State Merit Rank",
    href: "/rank-calculator",
    icon: Calculator,
  },
  {
    id: "explorer",
    label: "College Explorer (380 Institutes)",
    sublabel: "Browse every Maharashtra engineering college & branch cutoff",
    href: "/explorer",
    icon: Building2,
  },
  {
    id: "compare",
    label: "Side-by-Side College Compare",
    sublabel: "Compare up to 4 colleges across branches & categories",
    href: "/compare",
    icon: GitCompare,
  },
  {
    id: "analytics",
    label: "Multi-Year Cutoff Analytics",
    sublabel: "Inspect 2023–2025 Round 1–3 trajectories & 2026 outlook",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    id: "pricing",
    label: "Pricing & CAP Pro Pass (₹199)",
    sublabel: "Unlock full predictions, 60-choice Option Form & CSV/PDF exports",
    href: "/pricing",
    icon: Crown,
  },
  {
    id: "about",
    label: "About CAP Compass — Arsh Shaikh",
    sublabel: "Creator profile, platform mission & WhatsApp support",
    href: "/about",
    icon: User,
  },
];

interface CollegeHit {
  college_code: string;
  college_name: string;
  city: string;
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [colleges, setColleges] = useState<CollegeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setColleges([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setColleges([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${API_BASE}/colleges`, {
          params: { search: q, limit: 7 },
        });
        setColleges(res.data?.results || []);
      } catch {
        setColleges([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATIC_COMMANDS;
    return STATIC_COMMANDS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel.toLowerCase().includes(q)
    );
  }, [query]);

  const flatEntries = useMemo(() => {
    const toolEntries = filteredTools.map((t) => ({
      href: t.href,
      key: `tool-${t.id}`,
    }));
    const collegeEntries = colleges.map((c) => ({
      href: `/college/${c.college_code}`,
      key: `col-${c.college_code}`,
    }));
    return [...collegeEntries, ...toolEntries];
  }, [filteredTools, colleges]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, colleges.length]);

  if (!open) return null;

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatEntries.length) {
        setActiveIdx((i) => (i + 1) % flatEntries.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatEntries.length) {
        setActiveIdx((i) => (i - 1 + flatEntries.length) % flatEntries.length);
      }
    } else if (e.key === "Enter" && flatEntries[activeIdx]) {
      e.preventDefault();
      navigateTo(flatEntries[activeIdx].href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-xs flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <Search size={18} className="text-electric-blue shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search colleges by name or DTE code (e.g. VJTI, 6006, PICT) or jump to any tool..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {/* College hits */}
          {(colleges.length > 0 || searching) && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Engineering Colleges</span>
                {searching && <span className="text-electric-blue">Searching...</span>}
              </div>
              <div className="space-y-0.5">
                {colleges.map((c, idx) => {
                  const isActive = activeIdx === idx;
                  return (
                    <button
                      key={c.college_code}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navigateTo(`/college/${c.college_code}`)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isActive ? "bg-electric-blue/10 text-electric-blue" : "hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {c.college_code}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{c.college_name}</div>
                          <div className="text-[11px] text-slate-400">{c.city}</div>
                        </div>
                      </div>
                      <ArrowRight size={14} className="shrink-0 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tools */}
          {filteredTools.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                CAP Compass Tools &amp; Pages
              </div>
              <div className="space-y-0.5">
                {filteredTools.map((t, tIdx) => {
                  const globalIdx = colleges.length + tIdx;
                  const isActive = activeIdx === globalIdx;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onMouseEnter={() => setActiveIdx(globalIdx)}
                      onClick={() => navigateTo(t.href)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                        isActive ? "bg-electric-blue/10 text-electric-blue" : "hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-electric-blue text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span>{t.label}</span>
                            {t.badge && (
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  t.badge === "NEW"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-electric-blue/15 text-electric-blue"
                                }`}
                              >
                                {t.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {t.sublabel}
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={14} className="shrink-0 opacity-60" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredTools.length === 0 && colleges.length === 0 && !searching && (
            <div className="py-10 text-center text-xs text-slate-400">
              No matching colleges or tools found for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {/* Footer bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">↵</kbd>{" "}
              open
            </span>
          </div>
          <span className="flex items-center gap-1 font-medium text-slate-500">
            <Sparkles size={11} className="text-electric-blue" /> CAP Compass by Arsh Shaikh
          </span>
        </div>
      </div>
    </div>
  );
}
