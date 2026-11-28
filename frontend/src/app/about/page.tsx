import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  ListOrdered,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { GPAY_NUMBER, WHATSAPP_NUMBER } from "@/lib/plan";

export const metadata: Metadata = {
  title: "About CAP Compass | Arsh Shaikh",
  description:
    "CAP Compass — MHT-CET engineering admission intelligence platform built by Arsh Shaikh.",
};

const HIGHLIGHTS = [
  {
    icon: Database,
    title: "2023–2026 CAP Data",
    body: "198,336 official CET Cell cutoff records across 400 colleges and Rounds 1–4.",
  },
  {
    icon: BarChart3,
    title: "Dual Rank + %ile Engine",
    body: "Year-normalized rank scale with category-aware calibration.",
  },
  {
    icon: ListOrdered,
    title: "Complete CAP Toolkit",
    body: "Predictor, Option Form, Betterment Radar, ROI Finder & Interactive Map.",
  },
  {
    icon: ShieldCheck,
    title: "Hardened Security",
    body: "Google OAuth 2.0, PBKDF2 auth, RBAC, session revocation & audit logs.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#172554] text-white rounded-2xl p-7 sm:p-9 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="space-y-3">
            <BrandLogo variant="primary" theme="dark" size="md" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Built by Arsh Shaikh
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
              Data-driven MHT-CET college prediction and CAP Option Form guidance
              for Maharashtra engineering aspirants.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  "Hi Arsh! I have a question about CAP Compass."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <MessageCircle size={14} /> WhatsApp {GPAY_NUMBER}
              </a>
              <Link
                href="/?start=1"
                className="px-4 py-2 rounded-xl bg-white text-[#172554] hover:bg-[#EEF2FF] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                Open Predictor <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                <h.icon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172554]">{h.title}</h3>
                <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                  {h.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#172554]">
              CAP Compass Pro Pass
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              One-time ₹199 pass via Instant UPI or GPay ({GPAY_NUMBER}).
            </p>
          </div>
          <Link
            href="/pricing"
            className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <Sparkles size={14} /> View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
