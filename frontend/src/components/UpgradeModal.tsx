"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Crown,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  MessageCircle,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  GPAY_NUMBER,
  PLAN_DEFINITIONS,
  PlanSession,
  buildWhatsAppGPayUrl,
  getStoredPlan,
  saveStoredPlan,
  clearStoredPlan,
  isProActive,
} from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  initialPlan?: "pro" | "vip";
  reason?: string;
}

export default function UpgradeModal({
  open,
  onClose,
  initialPlan = "pro",
  reason,
}: UpgradeModalProps) {
  const [tab, setTab] = useState<"pay" | "activate">("pay");
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "vip">(initialPlan);
  const [copiedNum, setCopiedNum] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Payment submission form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Submitted receipt or existing session
  const [session, setSession] = useState<PlanSession>({ plan: "free" });
  const [receipt, setReceipt] = useState<{
    access_key: string;
    plan: string;
    amount_inr: number;
    status: string;
    message: string;
    utr_number?: string;
  } | null>(null);

  // Access key activation form
  const [keyInput, setKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{
    type: "success" | "pending" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedPlan(initialPlan);
      setErrorMsg("");
      setVerifyFeedback(null);
      const current = getStoredPlan();
      setSession(current);
      if (current.accessKey) {
        setKeyInput(current.accessKey);
      }
      if (isProActive(current)) {
        setTab("activate");
      } else {
        setTab("pay");
      }
    }
  }, [open, initialPlan]);

  if (!open) return null;

  const activePlanDef = PLAN_DEFINITIONS[selectedPlan];

  const copyText = (text: string, which: "num" | "key") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    if (which === "num") {
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/payments/submit`, {
        full_name: fullName,
        phone,
        email: email || null,
        plan: selectedPlan,
        utr_number: utrNumber,
      });
      const data = res.data;
      setReceipt({
        access_key: data.access_key,
        plan: data.plan,
        amount_inr: data.amount_inr,
        status: data.status,
        message: data.message,
        utr_number: utrNumber.trim().toUpperCase(),
      });
      setKeyInput(data.access_key);

      // Save pending or approved status locally (only elevate to Pro if server issued a signed entitlement token)
      const isApprovedWithToken =
        data.status === "approved" && Boolean(data.entitlement_token);
      const nextSession: PlanSession = {
        plan: isApprovedWithToken ? data.plan : "free",
        requestedPlan: data.plan,
        accessKey: data.access_key,
        entitlementToken: isApprovedWithToken ? data.entitlement_token : undefined,
        fullName,
        status: data.status,
        utrNumber: utrNumber.trim().toUpperCase(),
      };
      saveStoredPlan(nextSession);
      setSession(nextSession);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail ||
          "Could not submit GPay details. Please check your UTR and phone number."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyKey = async (overrideKey?: string) => {
    const keyToCheck = (overrideKey ?? keyInput).trim().toUpperCase();
    if (!keyToCheck) return;
    setVerifying(true);
    setVerifyFeedback(null);
    try {
      const res = await axios.get(`${API_BASE}/payments/verify`, {
        params: { access_key: keyToCheck },
      });
      const data = res.data;
      if (data.valid && data.entitlement_token) {
        const nextSession: PlanSession = {
          plan: data.plan,
          requestedPlan: data.requested_plan,
          accessKey: data.access_key,
          entitlementToken: data.entitlement_token,
          fullName: data.full_name,
          status: "approved",
          utrNumber: data.utr_number,
        };
        saveStoredPlan(nextSession);
        setSession(nextSession);
        if (receipt) {
          setReceipt({ ...receipt, status: "approved", message: data.message });
        }
        setVerifyFeedback({ type: "success", text: data.message });
      } else if (data.status === "pending") {
        setVerifyFeedback({ type: "pending", text: data.message });
      } else {
        setVerifyFeedback({ type: "error", text: data.message });
      }
    } catch {
      setVerifyFeedback({
        type: "error",
        text: "Unable to verify key right now. Please make sure the server is running.",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-6 py-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-electric-blue to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Crown size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                Upgrade to CAP Compass Pro
              </h3>
              <p className="text-xs text-slate-500">
                {reason || "Instant one-time pass via Google Pay (UPI)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close upgrade modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setTab("pay")}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === "pay"
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone size={14} className="text-electric-blue" /> Pay via
              GPay ({GPAY_NUMBER})
            </button>
            <button
              type="button"
              onClick={() => setTab("activate")}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                tab === "activate"
                  ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <KeyRound size={14} className="text-emerald-600" /> Activate
              Access Key
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {tab === "pay" && (
            <>
              {/* Plan Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["pro", "vip"] as const).map((pid) => {
                  const p = PLAN_DEFINITIONS[pid];
                  const active = selectedPlan === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setSelectedPlan(pid)}
                      className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                        active
                          ? "bg-electric-blue/[0.05] border-electric-blue ring-2 ring-electric-blue/15"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {p.badge && (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full absolute top-3 right-3 ${
                            pid === "pro"
                              ? "bg-electric-blue text-white"
                              : "bg-amber-500/15 text-amber-700 border border-amber-500/25"
                          }`}
                        >
                          {p.badge}
                        </span>
                      )}
                      <div className="text-sm font-bold text-slate-900 pr-20">
                        {p.name}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                          ₹{p.priceInr}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          / one-time
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                        {p.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Google Pay Direct Payment Banner */}
              <div className="bg-[#0B1120] text-white rounded-2xl p-5 border border-slate-800 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-electric-blue/25 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      <ShieldCheck size={13} /> Official Google Pay / UPI Number
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-wider text-white">
                        {GPAY_NUMBER}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(GPAY_NUMBER, "num")}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedNum ? (
                          <>
                            <Check size={13} className="text-emerald-400" />{" "}
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Accepts Google Pay (GPay), PhonePe, Paytm &amp; any UPI
                      App — Pay{" "}
                      <strong className="text-white font-mono">
                        ₹{activePlanDef.priceInr}
                      </strong>{" "}
                      to phone number{" "}
                      <strong className="text-white font-mono">
                        {GPAY_NUMBER}
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                {/* 3 Simple Steps */}
                <div className="relative z-10 mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                  <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/10">
                    <span className="font-mono text-blue-400 font-bold">
                      Step 1:
                    </span>{" "}
                    Open GPay &rarr; <strong>Pay Phone Number</strong> &rarr;{" "}
                    <span className="font-mono text-white">{GPAY_NUMBER}</span>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/10">
                    <span className="font-mono text-blue-400 font-bold">
                      Step 2:
                    </span>{" "}
                    Pay{" "}
                    <strong className="font-mono text-white">
                      ₹{activePlanDef.priceInr}
                    </strong>{" "}
                    &amp; copy the <strong>12-digit UPI UTR / Ref ID</strong>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-2.5 border border-white/10">
                    <span className="font-mono text-blue-400 font-bold">
                      Step 3:
                    </span>{" "}
                    Submit UTR below to receive your{" "}
                    <strong>Pro Access Key</strong>
                  </div>
                </div>
              </div>

              {/* Either Receipt OR UTR Form */}
              {receipt ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      size={22}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />
                    <div className="space-y-1 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {receipt.status === "approved"
                          ? "Payment Verified — Pro Unlocked!"
                          : "GPay Payment Recorded! Verification Pending"}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {receipt.message}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-emerald-200/80 p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Your Personal Access Key
                      </div>
                      <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900">
                        {receipt.access_key}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(receipt.access_key, "key")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedKey ? (
                        <>
                          <Check size={13} className="text-emerald-600" />{" "}
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy Key
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <a
                      href={buildWhatsAppGPayUrl({
                        planName: activePlanDef.name,
                        amountInr: receipt.amount_inr,
                        fullName,
                        utrNumber: receipt.utr_number,
                        accessKey: receipt.access_key,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <MessageCircle size={15} /> Send Screenshot on WhatsApp (
                      {GPAY_NUMBER})
                    </a>
                    <button
                      type="button"
                      onClick={() => handleVerifyKey(receipt.access_key)}
                      disabled={verifying}
                      className="px-4 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw
                        size={14}
                        className={verifying ? "animate-spin" : ""}
                      />{" "}
                      Check Activation
                    </button>
                  </div>

                  {verifyFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                        verifyFeedback.type === "success"
                          ? "bg-emerald-100 text-emerald-900"
                          : verifyFeedback.type === "pending"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-rose-100 text-rose-900"
                      }`}
                    >
                      {verifyFeedback.type === "success" ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Clock size={15} />
                      )}
                      {verifyFeedback.text}
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitPayment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Student / Parent Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Aarav Kulkarni"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-3 focus:ring-electric-blue/15"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        WhatsApp / Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-3 focus:ring-electric-blue/15"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        GPay UTR / UPI Transaction ID *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="12-digit UTR (e.g. 429812345678)"
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-3 focus:ring-electric-blue/15"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Email (Optional for Receipt)
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-3 focus:ring-electric-blue/15"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={15} /> {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-electric-blue hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-xl shadow-md shadow-electric-blue/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {submitting
                      ? "Recording Payment..."
                      : `Submit GPay Payment (₹${activePlanDef.priceInr}) & Get Access Key`}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </>
          )}

          {tab === "activate" && (
            <div className="space-y-5">
              {isProActive(session) && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Crown size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {PLAN_DEFINITIONS[session.plan].name} is Active!
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Key:{" "}
                        <span className="font-mono font-bold text-slate-900">
                          {session.accessKey}
                        </span>
                        {session.fullName ? ` • ${session.fullName}` : ""}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearStoredPlan();
                      setSession({ plan: "free" });
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer shrink-0"
                  >
                    Switch Account
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Enter Your CAP Compass Access Key
                </label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="e.g. CAP-PRO-A1B2C3"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-3 text-base font-mono tabular-nums font-bold uppercase bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyKey()}
                    disabled={verifying || !keyInput.trim()}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {verifying ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <KeyRound size={15} />
                    )}
                    Activate
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Paid via Google Pay (<strong>{GPAY_NUMBER}</strong>)? Enter
                  the Access Key generated after your UTR submission or sent to
                  you on WhatsApp.
                </p>
              </div>

              {verifyFeedback && (
                <div
                  className={`p-4 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                    verifyFeedback.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : verifyFeedback.type === "pending"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {verifyFeedback.type === "success" ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  ) : verifyFeedback.type === "pending" ? (
                    <Clock size={16} className="shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-2 flex-1">
                    <div>{verifyFeedback.text}</div>
                    {verifyFeedback.type === "pending" && (
                      <a
                        href={buildWhatsAppGPayUrl({
                          planName: "CAP Compass Pro/VIP",
                          amountInr: 199,
                          accessKey: keyInput.trim().toUpperCase(),
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:underline"
                      >
                        <MessageCircle size={14} /> Ping WhatsApp {GPAY_NUMBER}{" "}
                        for instant approval &rarr;
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
