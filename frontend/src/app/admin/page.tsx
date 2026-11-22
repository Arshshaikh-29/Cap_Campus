"use client";

import React, { useState } from "react";
import axios from "axios";
import {
  Lock,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Users,
  RefreshCw,
  Copy,
  Check,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GPAY_NUMBER } from "@/lib/plan";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function AdminRevenuePage() {
  const [pin, setPin] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<"orders" | "leads">("orders");

  // Direct manual key generator
  const [genName, setGenName] = useState("");
  const [genPhone, setGenPhone] = useState("");
  const [genPlan, setGenPlan] = useState<"pro" | "vip">("pro");
  const [genLoading, setGenLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const handleAuthError = (err: any) => {
    const status = err?.response?.status;
    if (status === 401) {
      setAdminToken(null);
      setOverview(null);
      setAuthError("Admin session expired or invalid credentials. Please sign in again.");
      return true;
    }
    if (status === 429) {
      setAuthError(
        err?.response?.data?.detail ||
          "Too many failed login attempts. Please try again later."
      );
      return true;
    }
    return false;
  };

  const fetchOverview = async (token: string) => {
    setLoading(true);
    setAuthError("");
    try {
      const res = await axios.get(`${API_BASE}/admin/overview`, {
        headers: authHeaders(token),
      });
      setOverview(res.data);
      setAdminToken(token);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setAuthError("Unable to connect to backend API.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setAuthError("");
    try {
      const loginRes = await axios.post(`${API_BASE}/admin/login`, {
        pin: pin.trim(),
      });
      const token = loginRes.data?.token;
      if (!token) {
        setAuthError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }
      setPin("");
      await fetchOverview(token);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setAuthError(
          err?.response?.data?.detail ||
            "Too many failed attempts. Login temporarily locked."
        );
      } else if (status === 401) {
        setAuthError(
          err?.response?.data?.detail || "Invalid Admin Security PIN."
        );
      } else {
        setAuthError("Unable to connect to backend API.");
      }
      setAdminToken(null);
      setLoading(false);
    }
  };

  const updateOrderStatus = async (
    orderId: number,
    status: "approved" | "rejected" | "pending"
  ) => {
    if (!adminToken) return;
    try {
      await axios.post(
        `${API_BASE}/admin/payments/${orderId}/status`,
        { status },
        { headers: authHeaders(adminToken) }
      );
      fetchOverview(adminToken);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        alert("Failed to update order status");
      }
    }
  };

  const updateLeadStatus = async (
    leadId: number,
    status: "new" | "contacted" | "resolved"
  ) => {
    if (!adminToken) return;
    try {
      await axios.post(
        `${API_BASE}/admin/leads/${leadId}/status`,
        { status },
        { headers: authHeaders(adminToken) }
      );
      fetchOverview(adminToken);
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setGenLoading(true);
    setCreatedKey(null);
    try {
      const res = await axios.post(
        `${API_BASE}/admin/keys/generate`,
        {
          full_name: genName || "Direct GPay Buyer",
          phone: genPhone || GPAY_NUMBER,
          plan: genPlan,
        },
        { headers: authHeaders(adminToken) }
      );
      setCreatedKey(res.data.access_key);
      setGenName("");
      setGenPhone("");
      fetchOverview(adminToken);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        alert("Could not generate access key");
      }
    } finally {
      setGenLoading(false);
    }
  };

  const copyText = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(val);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  if (!adminToken || !overview) {
    return (
      <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          autoComplete="off"
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-md w-full p-8 space-y-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#0B1120] text-white flex items-center justify-center">
            <Lock size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Owner Revenue Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verify Google Pay (<strong className="font-mono">{GPAY_NUMBER}</strong>)
              UTR payments, issue Pro/VIP Access Keys, and manage counselling
              leads.
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Admin Security PIN
            </label>
            <input
              type="password"
              autoComplete="current-password"
              maxLength={64}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter Owner Security PIN"
              className="w-full px-4 py-3 text-lg font-mono tracking-widest bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-electric-blue focus:ring-4 focus:ring-electric-blue/15"
            />
            <p className="text-[11px] text-slate-400">
              Protected by brute-force lockout &amp; signed expiring session tokens.
              Configure <code className="font-mono">CAP_ADMIN_PIN</code> in your server <code className="font-mono">.env</code> file.
            </p>
          </div>
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {authError}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 rounded-xl transition-all cursor-pointer"
          >
            {loading ? "Authenticating..." : "Unlock Revenue Dashboard"}
          </button>
        </form>
      </div>
    );
  }

  const m = overview.metrics;

  return (
    <div className="flex-1 bg-[#F8FAFC] py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md mb-2">
              <ShieldCheck size={14} /> Connected GPay Account: {overview.gpay_number}
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              CAP Compass Revenue &amp; GPay Admin
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchOverview(adminToken)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminToken(null);
                setOverview(null);
                setPin("");
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Lock Panel
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <IndianRupee size={14} className="text-emerald-600" /> Verified
              Revenue
            </div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 mt-2">
              ₹{Number(m.total_revenue_inr).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {m.approved_orders} approved passes
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-600" /> Pending GPay
              Approvals
            </div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 mt-2">
              {m.pending_orders}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              ₹{Number(m.pending_revenue_inr).toLocaleString()} awaiting check
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <KeyRound size={14} className="text-electric-blue" /> Total Orders
            </div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
              {m.total_orders}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              GPay {GPAY_NUMBER} submissions
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600" /> Counselling Leads
            </div>
            <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900 mt-2">
              {m.total_leads}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {m.new_leads} new callback requests
            </div>
          </div>
        </div>

        {/* Instant Manual Access Key Generator (for direct WhatsApp/GPay buyers) */}
        <form
          onSubmit={handleGenerateKey}
          className="bg-[#0B1120] text-white rounded-2xl p-6 flex flex-col lg:flex-row items-stretch lg:items-end gap-4"
        >
          <div className="flex-1 space-y-1">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} /> Instant Access Key Generator
            </div>
            <p className="text-xs text-slate-400">
              Received ₹199 or ₹499 directly on GPay ({GPAY_NUMBER})? Issue an
              instant pre-approved Access Key to send on WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-[540px]">
            <input
              type="text"
              placeholder="Student Name"
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
            <input
              type="tel"
              placeholder="Student Phone"
              value={genPhone}
              onChange={(e) => setGenPhone(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
            <select
              value={genPlan}
              onChange={(e) => setGenPlan(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-bold text-white focus:outline-none"
            >
              <option value="pro">CAP Pro (₹199)</option>
              <option value="vip">VIP 1-on-1 (₹499)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={genLoading}
            className="px-5 py-2.5 rounded-xl bg-electric-blue hover:bg-blue-500 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            {genLoading ? "Issuing..." : "Generate Approved Key"}
          </button>
        </form>

        {createdKey && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-emerald-900">
              Instant Pre-Approved Access Key Issued:{" "}
              <strong className="font-mono text-base ml-1">{createdKey}</strong>
            </div>
            <button
              type="button"
              onClick={() => copyText(createdKey)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === createdKey ? (
                <>
                  <Check size={13} /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy Key
                </>
              )}
            </button>
          </div>
        )}

        {/* Tabs: GPay Orders vs Counselling Leads */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-6 pt-4 border-b border-slate-200 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTab("orders")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                tab === "orders"
                  ? "border-electric-blue text-electric-blue"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              GPay Payment Orders ({overview.orders.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("leads")}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                tab === "leads"
                  ? "border-electric-blue text-electric-blue"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Counselling Callback Leads ({overview.leads.length})
            </button>
          </div>

          {tab === "orders" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Student &amp; Phone</th>
                    <th className="py-3 px-4">Plan &amp; Amount</th>
                    <th className="py-3 px-4">GPay UTR / Ref</th>
                    <th className="py-3 px-4">Access Key</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {overview.orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-slate-400"
                      >
                        No GPay orders yet. Share your website link or issue a
                        test key above!
                      </td>
                    </tr>
                  ) : (
                    overview.orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {o.full_name}
                          </div>
                          <a
                            href={`https://wa.me/91${o.phone}?text=${encodeURIComponent(
                              `Hi ${o.full_name}! Your CAP Compass ${o.plan.toUpperCase()} Access Key is ${o.access_key}. Enter it under Upgrade -> Activate Access Key!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <MessageCircle size={11} /> {o.phone}
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className="uppercase text-electric-blue">
                            {o.plan}
                          </span>{" "}
                          • ₹{o.amount_inr}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {o.utr_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => copyText(o.access_key)}
                            className="font-mono font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            {o.access_key}
                            {copiedKey === o.access_key ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} className="text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              o.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {o.status !== "approved" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(o.id, "approved")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                          )}
                          {o.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => updateOrderStatus(o.id, "rejected")}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Student / Parent</th>
                    <th className="py-3 px-4">Score &amp; Category</th>
                    <th className="py-3 px-4">Preferred Branch &amp; Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {overview.leads.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-slate-400"
                      >
                        No counselling callback requests yet.
                      </td>
                    </tr>
                  ) : (
                    overview.leads.map((l: any) => (
                      <tr key={l.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {l.full_name}
                          </div>
                          <a
                            href={`https://wa.me/91${l.phone}?text=${encodeURIComponent(
                              `Hi ${l.full_name}! Reaching out from CAP Compass regarding your MHT-CET counselling request.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <MessageCircle size={11} /> {l.phone}
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div>{l.score_info || "-"}</div>
                          <div className="text-[11px] text-slate-500">
                            {l.category || "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-electric-blue">
                            {l.preferred_branch || "Any Branch"}
                          </div>
                          <div className="text-slate-600 line-clamp-2">
                            {l.message || "-"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                              l.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : l.status === "contacted"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => updateLeadStatus(l.id, "contacted")}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold cursor-pointer"
                          >
                            Contacted
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLeadStatus(l.id, "resolved")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                          >
                            Resolved
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
