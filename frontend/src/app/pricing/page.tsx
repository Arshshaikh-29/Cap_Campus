"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import {
  CheckCircle2,
  Crown,
  Sparkles,
  Smartphone,
  Copy,
  Check,
  MessageCircle,
  ShieldCheck,
  PhoneCall,
  ArrowRight,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import {
  GPAY_NUMBER,
  WHATSAPP_NUMBER,
  PLAN_DEFINITIONS,
  PlanSession,
  getStoredPlan,
  isProActive,
  openUpgradeModal,
} from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function PricingPage() {
  const [copied, setCopied] = useState(false);
  const [planSession, setPlanSession] = useState<PlanSession>({ plan: "free" });

  // Counselling callback lead form
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadScore, setLeadScore] = useState("");
  const [leadCategory, setLeadCategory] = useState("GOPENS");
  const [leadBranch, setLeadBranch] = useState("Computer Engineering");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState("");
  const [leadError, setLeadError] = useState("");

  useEffect(() => {
    const sync = () => setPlanSession(getStoredPlan());
    sync();
    window.addEventListener("cap_plan_updated", sync);
    return () => window.removeEventListener("cap_plan_updated", sync);
  }, []);

  const copyNumber = () => {
    navigator.clipboard?.writeText(GPAY_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError("");
    setLeadSuccess("");
    setLeadSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/leads`, {
        full_name: leadName,
        phone: leadPhone,
        score_info: leadScore,
        category: leadCategory,
        preferred_branch: leadBranch,
        message: leadMessage,
      });
      setLeadSuccess(res.data.message);
      setLeadName("");
      setLeadPhone("");
      setLeadScore("");
      setLeadMessage("");
    } catch (err: any) {
      setLeadError(
        err?.response?.data?.detail ||
          "Could not submit callback request. Please check your phone number."
      );
    } finally {
      setLeadSubmitting(false);
    }
  };

  const proActive = isProActive(planSession);

  return (
    <div className="flex-1 bg-[#F8FAFC] py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-14">
        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/10 border border-electric-blue/20 text-electric-blue text-xs font-bold uppercase tracking-wider">
            <Crown size={13} /> Transparent One-Time CAP Season Plans
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Maximize Your Engineering Seat Allotment.
          </h1>
          <p className="text-base sm:text-lg text-slate-500 leading-relaxed">
            One small mistake in your CAP Option Form order can cost you a top
            autonomous seat. Unlock unlimited predictions, DTE Choice Code
            exports, and personal mentor support via instant Google Pay.
          </p>
        </div>

        {/* 3-Tier Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {(["free", "pro", "vip"] as const).map((tierId) => {
            const p = PLAN_DEFINITIONS[tierId];
            const isPopular = tierId === "pro";
            const isCurrent = planSession.plan === tierId;

            return (
              <div
                key={tierId}
                className={`rounded-3xl p-7 sm:p-8 flex flex-col justify-between transition-all relative ${
                  isPopular
                    ? "bg-[#0B1120] text-white border-2 border-electric-blue shadow-[0_24px_60px_-15px_rgba(37,99,235,0.28)]"
                    : "bg-white text-slate-900 border border-slate-200/90 shadow-xs"
                }`}
              >
                {p.badge && (
                  <span
                    className={`absolute -top-3.5 right-6 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs ${
                      isPopular
                        ? "bg-electric-blue text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {p.badge}
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <h2
                      className={`text-xl font-bold ${
                        isPopular ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {p.name}
                    </h2>
                    <p
                      className={`text-xs mt-1.5 ${
                        isPopular ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {p.tagline}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5 pb-6 border-b border-current/10">
                    <span className="text-4xl font-extrabold font-mono tabular-nums">
                      ₹{p.priceInr}
                    </span>
                    <span
                      className={`text-xs ${
                        isPopular ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {p.validity}
                    </span>
                  </div>

                  <ul className="space-y-3 text-xs sm:text-sm">
                    {p.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2
                          size={16}
                          className={`shrink-0 mt-0.5 ${
                            isPopular ? "text-teal-400" : "text-emerald-600"
                          }`}
                        />
                        <span
                          className={
                            isPopular ? "text-slate-200" : "text-slate-600"
                          }
                        >
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  {tierId === "free" ? (
                    <Link
                      href="/?start=1"
                      className="w-full py-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      Start Free Predictor <ArrowRight size={15} />
                    </Link>
                  ) : isCurrent ? (
                    <div className="w-full py-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-500 font-bold text-sm text-center">
                      ✓ Your Active Plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openUpgradeModal(tierId)}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isPopular
                          ? "bg-electric-blue hover:bg-blue-500 text-white shadow-lg shadow-electric-blue/30"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <Sparkles size={15} /> Pay ₹{p.priceInr} &amp; Unlock
                      Instantly
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Official Google Pay Verification Strip */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <ShieldCheck size={14} /> Direct Google Pay / UPI Checkout
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              Official Google Pay Number:{" "}
              <span className="font-mono tabular-nums text-electric-blue">
                {GPAY_NUMBER}
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Pay directly via <strong>Google Pay</strong>,{" "}
              <strong>PhonePe</strong>, or <strong>Paytm</strong> to phone number{" "}
              <strong className="font-mono text-slate-900">{GPAY_NUMBER}</strong>,
              submit your 12-digit UTR to receive your Access Key, or ping us on
              WhatsApp for fast activation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={copyNumber}
              className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" /> Copied{" "}
                  {GPAY_NUMBER}
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy GPay: {GPAY_NUMBER}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => openUpgradeModal("pro")}
              className="px-4 py-3 rounded-xl bg-electric-blue hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <KeyRound size={14} />{" "}
              {proActive ? "Manage Access Key" : "Submit UTR / Activate Key"}
            </button>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                "Hi CAP Compass Team! I have a question about CAP Pro / VIP Counselling."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2"
            >
              <MessageCircle size={14} /> WhatsApp Support
            </a>
          </div>
        </div>

        {/* 1-on-1 Counselling Callback Request Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-electric-blue">
              <PhoneCall size={14} /> Personal CAP Counselling
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Need 1-on-1 Help With Your Option Form?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Unsure about TFWS vs EWS, Home University (H) vs State Level (S),
              or whether to freeze vs go for Round 2 betterment? Leave your
              details and our CAP counsellor will call or WhatsApp you.
            </p>
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 space-y-1.5 text-xs text-slate-700">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone size={14} className="text-electric-blue" /> Direct
                Helpline &amp; GPay
              </div>
              <div>
                WhatsApp / GPay:{" "}
                <strong className="font-mono text-slate-900">
                  +91 {GPAY_NUMBER}
                </strong>
              </div>
              <div>Response time: Usually within 15–30 minutes (9 AM – 10 PM).</div>
            </div>
          </div>

          <form
            onSubmit={handleLeadSubmit}
            className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Student / Parent Name *
                </label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Rohan Deshmukh"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Phone / WhatsApp Number *
                </label>
                <input
                  type="tel"
                  required
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Percentile or Rank
                </label>
                <input
                  type="text"
                  value={leadScore}
                  onChange={(e) => setLeadScore(e.target.value)}
                  placeholder="e.g. 96.4% or #12000"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  value={leadCategory}
                  onChange={(e) => setLeadCategory(e.target.value)}
                  placeholder="GOPENS / GOBCS / EWS"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Preferred Branch
                </label>
                <input
                  type="text"
                  value={leadBranch}
                  onChange={(e) => setLeadBranch(e.target.value)}
                  placeholder="CS / IT / ENTC"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Questions / Target Cities
              </label>
              <textarea
                rows={3}
                value={leadMessage}
                onChange={(e) => setLeadMessage(e.target.value)}
                placeholder="Tell us your target colleges, budget, or CAP round questions..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue"
              />
            </div>

            {leadSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} /> {leadSuccess}
              </div>
            )}
            {leadError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {leadError}
              </div>
            )}

            <button
              type="submit"
              disabled={leadSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {leadSubmitting ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <PhoneCall size={15} />
              )}
              {leadSubmitting
                ? "Submitting Request..."
                : "Request Free Counselling Callback"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
