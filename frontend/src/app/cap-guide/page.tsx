"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Info,
  ListOrdered,
  Printer,
  RotateCcw,
  ShieldAlert,
  Snowflake,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

type CategoryGroup =
  | "OPEN"
  | "OBC"
  | "SEBC"
  | "VJNT_SBC"
  | "SC_ST"
  | "EWS"
  | "TFWS"
  | "MINORITY"
  | "PWD"
  | "DEFENCE";

const CATEGORY_GROUPS: { id: CategoryGroup; label: string; hint: string }[] = [
  { id: "OPEN", label: "OPEN (General)", hint: "GOPEN / LOPEN" },
  { id: "OBC", label: "OBC", hint: "GOBC / LOBC" },
  { id: "SEBC", label: "SEBC", hint: "GSEBC / LSEBC" },
  { id: "VJNT_SBC", label: "VJ / NT-1 / NT-2 / NT-3", hint: "GVJ, GNT1–3" },
  { id: "SC_ST", label: "SC / ST", hint: "GSC / GST" },
  { id: "EWS", label: "EWS", hint: "Economically Weaker" },
  { id: "TFWS", label: "TFWS", hint: "Tuition Fee Waiver" },
  { id: "MINORITY", label: "Minority", hint: "Linguistic / Religious" },
  { id: "PWD", label: "PWD", hint: "Persons with Disability" },
  { id: "DEFENCE", label: "Defence", hint: "DEF quota" },
];

interface DocItem {
  id: string;
  title: string;
  note?: string;
  appliesTo: "ALL" | CategoryGroup[];
}

const DOCUMENTS: DocItem[] = [
  { id: "cet_score", title: "MHT-CET / JEE Main Score Card", appliesTo: "ALL" },
  { id: "ssc", title: "SSC (Class 10) Marksheet", note: "Also used as proof of date of birth", appliesTo: "ALL" },
  { id: "hsc", title: "HSC (Class 12) Marksheet", note: "Physics, Chemistry & Maths marks", appliesTo: "ALL" },
  { id: "lc", title: "School / College Leaving Certificate", appliesTo: "ALL" },
  { id: "domicile", title: "Domicile Certificate (Maharashtra)", note: "Required for Maharashtra State candidature types", appliesTo: "ALL" },
  { id: "nationality", title: "Nationality Certificate / Indian Passport", note: "Domicile certificate stating 'Indian' is usually accepted", appliesTo: "ALL" },
  { id: "aadhaar", title: "Aadhaar Card", appliesTo: "ALL" },
  { id: "photo", title: "Recent Passport-size Photograph & Signature", appliesTo: "ALL" },
  { id: "caste", title: "Caste Certificate", appliesTo: ["OBC", "SEBC", "VJNT_SBC", "SC_ST"] },
  { id: "validity", title: "Caste Validity Certificate", note: "Or receipt of application as allowed by CET Cell rules", appliesTo: ["OBC", "SEBC", "VJNT_SBC", "SC_ST"] },
  { id: "ncl", title: "Non-Creamy Layer Certificate (valid for current financial year)", appliesTo: ["OBC", "SEBC", "VJNT_SBC"] },
  { id: "ews_cert", title: "EWS Eligibility Certificate", note: "Issued by competent authority for the current year", appliesTo: ["EWS"] },
  { id: "income", title: "Family Income Certificate (from Tahsildar)", note: "TFWS requires annual family income within the CET Cell limit", appliesTo: ["TFWS", "EWS"] },
  { id: "minority_decl", title: "Minority Declaration / Proof of Minority Community", note: "As per the format in the CET Cell brochure", appliesTo: ["MINORITY"] },
  { id: "pwd_cert", title: "Disability Certificate (UDID / Medical Board)", appliesTo: ["PWD"] },
  { id: "def_cert", title: "Defence Service Certificate of Parent / Guardian", appliesTo: ["DEFENCE"] },
];

const CAP_STEPS: { title: string; body: string }[] = [
  {
    title: "Online Registration & Fee Payment",
    body: "Register on the State CET Cell CAP portal, fill personal, academic and category details, and pay the registration fee.",
  },
  {
    title: "Document Upload & Scrutiny",
    body: "Upload scanned originals. Choose E-Scrutiny (online verification) or Physical Scrutiny at a Facilitation Centre. Track remarks and fix discrepancies quickly.",
  },
  {
    title: "Provisional Merit List & Grievances",
    body: "Check your State / All-India merit number and category details. Raise a grievance before the deadline if anything is wrong.",
  },
  {
    title: "Final Merit List",
    body: "Your final State Merit Rank is what CAP uses for seat allotment — use it in CAP Compass for the most accurate predictions.",
  },
  {
    title: "CAP Round Option Form",
    body: "Fill and confirm your ordered list of choice codes. Put Dream choices first, then Target, then Safe seats. Unconfirmed forms are not considered.",
  },
  {
    title: "Seat Allotment, Acceptance & Reporting",
    body: "Check allotment, accept the seat (Freeze / Not Freeze as allowed in that round), pay the seat acceptance fee and report to the institute within the deadline.",
  },
  {
    title: "Subsequent CAP Rounds & Institute-Level",
    body: "Continue in later rounds for betterment if eligible. Remaining vacancies are filled through institute-level / against-CAP rounds.",
  },
];

const STORAGE_KEY = "cap_compass_doc_checklist_v1";

export default function CapGuidePage() {
  const [group, setGroup] = useState<CategoryGroup>("OPEN");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.group === "string") setGroup(parsed.group as CategoryGroup);
          if (parsed.checked && typeof parsed.checked === "object") setChecked(parsed.checked);
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const persist = (nextGroup: CategoryGroup, nextChecked: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ group: nextGroup, checked: nextChecked })
      );
    } catch {
      // ignore
    }
  };

  const docs = useMemo(
    () =>
      DOCUMENTS.filter(
        (d) => d.appliesTo === "ALL" || d.appliesTo.includes(group)
      ),
    [group]
  );

  const doneCount = docs.filter((d) => checked[d.id]).length;
  const progress = docs.length ? Math.round((doneCount / docs.length) * 100) : 0;

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    persist(group, next);
  };

  const selectGroup = (g: CategoryGroup) => {
    setGroup(g);
    persist(g, checked);
  };

  const resetAll = () => {
    setChecked({});
    persist(group, {});
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-bold uppercase tracking-wider">
              <BookOpenCheck size={13} /> Free CAP Admission Toolkit
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              CAP Guide &amp; Document Checklist
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              A step-by-step walkthrough of the Maharashtra engineering CAP
              process, plus a personalised document checklist for your category.
              Your progress is saved on this device.
            </p>
          </div>
          <div className="flex gap-2.5 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Print Checklist
            </button>
            <Link
              href="/?start=1"
              className="px-4 py-2.5 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              Predict Colleges <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Document Checklist */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-electric-blue" />
                Document Checklist
              </h2>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer print:hidden"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>

            <div className="space-y-2 print:hidden">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Your Category
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => selectGroup(g.id)}
                    title={g.hint}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      group === g.id
                        ? "bg-electric-blue text-white border-electric-blue shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-electric-blue/40"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>
                  {doneCount} of {docs.length} documents ready
                </span>
                <span className="font-mono tabular-nums text-electric-blue">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress === 100 ? "bg-emerald-500" : "bg-electric-blue"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {docs.map((d) => {
                const isDone = Boolean(checked[d.id]);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => toggle(d.id)}
                      className="w-full flex items-start gap-3 py-3 text-left cursor-pointer group"
                    >
                      {isDone ? (
                        <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Circle size={20} className="text-slate-300 group-hover:text-electric-blue shrink-0 mt-0.5" />
                      )}
                      <span className="space-y-0.5">
                        <span
                          className={`block text-sm font-semibold ${
                            isDone ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {d.title}
                        </span>
                        {d.note && (
                          <span className="block text-xs text-slate-500">{d.note}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700">
              <Info size={15} className="text-electric-blue shrink-0 mt-0.5" />
              <span>
                Keep originals plus 2 self-attested photocopies of every document.
                Exact requirements change every year — always cross-check with the
                official State CET Cell information brochure for the current
                admission year.
              </span>
            </div>
          </div>

          {/* CAP Process Timeline */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
                <ListOrdered size={18} className="text-electric-blue" />
                CAP Process — Step by Step
              </h2>
              <ol className="relative space-y-5">
                <span className="absolute left-[13px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />
                {CAP_STEPS.map((s, i) => (
                  <li key={s.title} className="relative flex gap-3.5">
                    <span className="relative z-10 w-7 h-7 shrink-0 rounded-full bg-[#0B1120] text-white text-xs font-bold font-mono flex items-center justify-center ring-4 ring-white">
                      {i + 1}
                    </span>
                    <div className="space-y-0.5 pt-0.5">
                      <div className="text-sm font-bold text-slate-900">{s.title}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-[#0B1120] text-white rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-blue-300">
                Freeze vs Betterment — Quick Explainer
              </h3>
              <div className="flex gap-3">
                <Snowflake size={18} className="text-sky-300 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Freeze:</strong> you accept the
                  allotted seat and opt out of later rounds. Choose this when you
                  are happy with the college.
                </p>
              </div>
              <div className="flex gap-3">
                <TrendingUp size={18} className="text-emerald-300 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Not Freeze / Betterment:</strong>{" "}
                  you keep the seat but stay eligible for a higher preference in
                  the next round.
                </p>
              </div>
              <div className="flex gap-3">
                <ShieldAlert size={18} className="text-amber-300 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  If you are allotted your <strong className="text-white">1st preference</strong>,
                  the seat is usually auto-frozen — so only list colleges you
                  would genuinely join.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-electric-blue" /> Next steps in CAP Compass
              </h3>
              <div className="grid grid-cols-1 gap-2 text-xs font-semibold">
                <Link href="/what-if" className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-electric-blue/40 hover:bg-slate-50 flex justify-between items-center">
                  Score Impact Simulator <ArrowRight size={13} />
                </Link>
                <Link href="/option-form" className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-electric-blue/40 hover:bg-slate-50 flex justify-between items-center">
                  Build Smart Option Form <ArrowRight size={13} />
                </Link>
                <Link href="/rank-calculator" className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-electric-blue/40 hover:bg-slate-50 flex justify-between items-center">
                  Percentile ↔ Rank Calculator <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
