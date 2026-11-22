import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Code2,
  Compass,
  Database,
  Heart,
  ListOrdered,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GPAY_NUMBER, WHATSAPP_NUMBER } from "@/lib/plan";

export const metadata: Metadata = {
  title: "About CAP Compass | Built by Arsh Shaikh",
  description:
    "CAP Compass is an MHT-CET engineering admission predictor designed and developed by Arsh Shaikh to help Maharashtra students make smarter CAP decisions.",
};

const HIGHLIGHTS = [
  {
    icon: Database,
    title: "Real CAP Data",
    body: "Built on official State CET Cell CAP cutoff lists for 2023–2025, Rounds 1–3, across 380 Maharashtra engineering colleges.",
  },
  {
    icon: BarChart3,
    title: "Dual Rank + Percentile Engine",
    body: "Year-normalised merit-rank scale with category-aware calibration, so predictions stay consistent whether you enter percentile or rank.",
  },
  {
    icon: ListOrdered,
    title: "Counselling-Grade Tools",
    body: "Smart Option Form builder, What-If simulator, college comparison and a CAP document checklist — all in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    body: "Rate limiting, signed sessions, brute-force protection and strict security headers keep student data safe.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex-1 bg-[#F8FAFC] py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Creator hero */}
        <div className="relative overflow-hidden bg-[#0B1120] text-white rounded-3xl p-8 sm:p-12">
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-electric-blue/30 blur-3xl" aria-hidden />
          <div className="relative flex flex-col sm:flex-row gap-8 items-start sm:items-center">
            <div className="w-24 h-24 shrink-0 rounded-3xl bg-gradient-to-br from-electric-blue to-indigo-600 flex items-center justify-center text-3xl font-extrabold tracking-tight shadow-xl ring-4 ring-white/10">
              AS
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-blue-200">
                <Code2 size={12} /> Creator &amp; Developer
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Built by Arsh Shaikh
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                CAP Compass was designed and developed by{" "}
                <strong className="text-white">Arsh Shaikh</strong> to make the
                Maharashtra engineering CAP process less confusing. Every
                feature — from the dual rank–percentile predictor to the Smart
                Option Form — is built to help students and parents make
                data-driven admission decisions.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    "Hi Arsh! I have a question about CAP Compass."
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <MessageCircle size={14} /> WhatsApp {GPAY_NUMBER}
                </a>
                <Link
                  href="/?start=1"
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5"
                >
                  Try the Predictor <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Compass size={20} className="text-electric-blue" /> Why CAP Compass?
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every year, lakhs of MHT-CET students juggle PDF cutoff lists,
            category codes like GOPENS / LOBCH / TFWS, and a confusing option
            form with hundreds of choice codes. One wrong order can cost a
            better seat. CAP Compass turns that raw data into clear, honest
            guidance — what is realistic, what is a stretch, and how to order
            your preferences.
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-electric-blue/10 text-electric-blue flex items-center justify-center">
                <h.icon size={20} />
              </div>
              <h3 className="font-bold text-slate-900">{h.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{h.body}</p>
            </div>
          ))}
        </div>

        {/* Support */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-electric-blue/10 to-indigo-500/10 border border-electric-blue/20">
          <div className="space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Heart size={16} className="text-rose-500" /> Support the project
            </div>
            <p className="text-xs text-slate-600">
              CAP Pro Pass keeps CAP Compass running and improving. Pay securely
              via Google Pay on <strong className="font-mono">{GPAY_NUMBER}</strong>.
            </p>
          </div>
          <Link
            href="/pricing"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Sparkles size={14} /> View Plans
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400">
          CAP Compass is an independent decision-support tool and is not
          affiliated with the State CET Cell or DTE Maharashtra.
        </p>
      </div>
    </div>
  );
}
