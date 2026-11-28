"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
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
  ShieldAlert,
  Sparkles,
  Database,
  Activity,
  UserCheck,
  Eye,
  EyeOff,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import {
  Card,
  StatCard,
  Badge,
  EmptyState,
  TableSkeleton,
} from "@/components/ui/Primitives";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/ToastProvider";
import { GPAY_NUMBER } from "@/lib/plan";
import { AuthSession, getStoredAuth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const PAGE_SIZE = 10;

export default function AdminRevenuePage() {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSummary, setAuditSummary] = useState<any>(null);
  const [auditSeverity, setAuditSeverity] = useState<"" | "critical" | "warning" | "info">("");
  const [tab, setTab] = useState<"orders" | "leads" | "users" | "audit">("orders");
  const [googleAuth, setGoogleAuth] = useState<AuthSession | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<number | null>(null);

  // Table search, status filter, sort & pagination
  const [tableQuery, setTableQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  // Confirmation modal for destructive actions
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: "danger" | "primary";
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Direct manual key generator
  const [genName, setGenName] = useState("");
  const [genPhone, setGenPhone] = useState("");
  const [genPlan, setGenPlan] = useState<"pro" | "vip">("pro");
  const [genLoading, setGenLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setGoogleAuth(getStoredAuth());
  }, []);

  useEffect(() => {
    setTableQuery("");
    setStatusFilter("all");
    setPage(1);
  }, [tab]);

  const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  const handleAuthError = (err: any) => {
    const status = err?.response?.status;
    if (status === 401) {
      setAdminToken(null);
      setOverview(null);
      setAuthError(
        err?.response?.data?.detail ||
          "Admin session expired or invalid credentials. Please sign in again."
      );
      return true;
    }
    if (status === 403) {
      setAuthError(
        err?.response?.data?.detail ||
          "Access denied: your account does not have Administrator privileges."
      );
      return true;
    }
    if (status === 429 || status === 503) {
      setAuthError(
        err?.response?.data?.detail ||
          "Admin login is temporarily restricted. Please try again later."
      );
      return true;
    }
    return false;
  };

  const fetchAuditLogs = async (
    token: string,
    severity: "" | "critical" | "warning" | "info" = auditSeverity
  ) => {
    try {
      const params: Record<string, string | number> = { limit: 150 };
      if (severity) params.severity = severity;
      const res = await axios.get(`${API_BASE}/admin/audit-logs`, {
        headers: authHeaders(token),
        params,
      });
      setAuditLogs(res.data?.logs || []);
      setAuditSummary(res.data?.summary || null);
    } catch {
      // non-blocking
    }
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
      fetchAuditLogs(token, auditSeverity);
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
    if (!pin.trim() || loading) return;
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
      showToast("Admin console unlocked", "success");
      await fetchOverview(token);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setAuthError("Unable to connect to backend API.");
      }
      setAdminToken(null);
      setLoading(false);
    }
  };

  const handleGoogleAdminUnlock = async () => {
    const sess = getStoredAuth();
    if (!sess?.token) {
      setAuthError("Sign in with Google on /login first to use Super-Admin Google auth.");
      return;
    }
    await fetchOverview(sess.token);
  };

  const handleLockPanel = async () => {
    const tok = adminToken;
    setAdminToken(null);
    setOverview(null);
    setAuditLogs([]);
    setPin("");
    if (tok) {
      axios
        .post(`${API_BASE}/admin/logout`, {}, { headers: authHeaders(tok) })
        .catch(() => undefined);
    }
    showToast("Admin session revoked", "info", "Signed out cleanly from executive console.");
  };

  const executeOrderStatus = async (
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
      showToast(`Order #${orderId} marked ${status}`, status === "rejected" ? "warning" : "success");
      await fetchOverview(adminToken);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        showToast("Failed to update order status", "error");
      }
    }
  };

  const updateOrderStatus = (
    orderId: number,
    status: "approved" | "rejected" | "pending",
    accessKey: string
  ) => {
    if (status === "rejected") {
      setConfirmState({
        open: true,
        title: "Reject Payment Order?",
        description: `Rejecting order ${accessKey} will immediately revoke any associated Pro/VIP entitlement token on the server.`,
        confirmLabel: "Reject & Revoke",
        tone: "danger",
        onConfirm: async () => {
          await executeOrderStatus(orderId, status);
        },
      });
      return;
    }
    executeOrderStatus(orderId, status);
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
      showToast(`Lead marked ${status}`, "success");
      await fetchOverview(adminToken);
    } catch (err: any) {
      handleAuthError(err);
    }
  };

  const executeUserRoleUpdate = async (
    userId: number,
    role: string,
    isActive: boolean
  ) => {
    if (!adminToken) return;
    setRoleBusyId(userId);
    try {
      await axios.post(
        `${API_BASE}/admin/users/${userId}/role`,
        { role, is_active: isActive },
        { headers: authHeaders(adminToken) }
      );
      showToast(
        "User permissions updated",
        "success",
        `Role set to ${role} (${isActive ? "Active" : "Suspended"}). Old tokens invalidated.`
      );
      await fetchOverview(adminToken);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        showToast(
          "Could not update role",
          "error",
          err?.response?.data?.detail || "Super-Admin privileges required."
        );
      }
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleUpdateUserRole = (
    user: any,
    role: string,
    isActive: boolean
  ) => {
    if (!isActive && user.is_active !== false) {
      setConfirmState({
        open: true,
        title: `Suspend ${user.full_name}?`,
        description: `Suspending ${user.email} immediately revokes all active sessions and blocks sign-in until reactivated.`,
        confirmLabel: "Suspend Account",
        tone: "danger",
        onConfirm: async () => {
          await executeUserRoleUpdate(user.id, role, false);
        },
      });
      return;
    }
    executeUserRoleUpdate(user.id, role, isActive);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || genLoading) return;
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
      showToast("Pre-approved Access Key issued", "success", res.data.access_key);
      fetchOverview(adminToken);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        showToast("Could not generate access key", "error");
      }
    } finally {
      setGenLoading(false);
    }
  };

  const copyText = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedKey(val);
    showToast("Copied to clipboard", "info", val);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  // Filtered, sorted & paginated data for active table
  const filteredRows = useMemo(() => {
    if (!overview) return [];
    const q = tableQuery.trim().toLowerCase();
    let list: any[] = [];

    if (tab === "orders") {
      list = [...(overview.orders || [])];
      if (statusFilter !== "all") {
        list = list.filter((o) => o.status === statusFilter);
      }
      if (q) {
        list = list.filter(
          (o) =>
            String(o.full_name || "").toLowerCase().includes(q) ||
            String(o.phone || "").toLowerCase().includes(q) ||
            String(o.utr_number || "").toLowerCase().includes(q) ||
            String(o.access_key || "").toLowerCase().includes(q)
        );
      }
    } else if (tab === "leads") {
      list = [...(overview.leads || [])];
      if (statusFilter !== "all") {
        list = list.filter((l) => l.status === statusFilter);
      }
      if (q) {
        list = list.filter(
          (l) =>
            String(l.full_name || "").toLowerCase().includes(q) ||
            String(l.phone || "").toLowerCase().includes(q) ||
            String(l.preferred_branch || "").toLowerCase().includes(q) ||
            String(l.category || "").toLowerCase().includes(q)
        );
      }
    } else if (tab === "users") {
      list = [...(overview.users || [])];
      if (statusFilter !== "all") {
        list = list.filter((u) => (u.role || "student") === statusFilter);
      }
      if (q) {
        list = list.filter(
          (u) =>
            String(u.full_name || "").toLowerCase().includes(q) ||
            String(u.email || "").toLowerCase().includes(q) ||
            String(u.saved_category || "").toLowerCase().includes(q)
        );
      }
    } else {
      list = [...auditLogs];
      if (q) {
        list = list.filter(
          (a) =>
            String(a.event_type || "").toLowerCase().includes(q) ||
            String(a.actor_identity || "").toLowerCase().includes(q) ||
            String(a.target_resource || "").toLowerCase().includes(q) ||
            String(a.ip_address || "").toLowerCase().includes(q) ||
            String(a.details || "").toLowerCase().includes(q)
        );
      }
    }

    if (sortAsc) {
      list.reverse();
    }
    return list;
  }, [overview, auditLogs, tab, tableQuery, statusFilter, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Real-data Recharts datasets (zero fabricated stats)
  const orderChartData = useMemo(() => {
    const orders = overview?.orders || [];
    return [
      {
        name: "Approved",
        count: orders.filter((o: any) => o.status === "approved").length,
      },
      {
        name: "Pending",
        count: orders.filter((o: any) => o.status === "pending").length,
      },
      {
        name: "Rejected",
        count: orders.filter((o: any) => o.status === "rejected").length,
      },
    ];
  }, [overview]);

  const securityChartData = useMemo(() => {
    const s = auditSummary || { total: 0, critical: 0, warning: 0, blocked: 0 };
    const infoCount = Math.max(0, (s.total || 0) - (s.critical || 0) - (s.warning || 0));
    return [
      { name: "Info", count: infoCount },
      { name: "Warning", count: s.warning || 0 },
      { name: "Critical", count: s.critical || 0 },
      { name: "Blocked", count: s.blocked || 0 },
    ];
  }, [auditSummary]);

  /* ADMIN AUTHENTICATION SCREEN */
  if (!adminToken || !overview) {
    return (
      <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-[0_12px_40px_-16px_rgba(23,37,84,0.12)] max-w-md w-full p-7 sm:p-9 space-y-6">
          <div className="flex items-center justify-between">
            <BrandLogo variant="primary" theme="light" size="md" showTagline />
            <span className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
              <Lock size={17} />
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-[#172554]">
              Executive &amp; Security Console
            </h1>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Manage GPay (<span className="font-mono font-semibold text-[#172554]">{GPAY_NUMBER}</span>)
              orders, counselling leads, user RBAC roles, and real-time security audit logs.
            </p>
          </div>

          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-semibold text-[#1E293B]"
              >
                Admin Security PIN <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-pin-input"
                  type={showPin ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={64}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your private Admin PIN"
                  className="w-full pl-4 pr-11 py-3 text-sm font-mono tracking-wider bg-white border border-[#E2E8F0] rounded-xl text-[#172554] focus:outline-none focus:border-[#4F46E5] focus:ring-3 focus:ring-[#4F46E5]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#172554] cursor-pointer"
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Protected by PBKDF2-HMAC-SHA256 hashing, brute-force lockout &amp; JTI revocation.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full bg-[#172554] hover:bg-[#1E3A8A] disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw size={15} className="animate-spin" />}
              {loading ? "Authenticating..." : "Unlock Console"}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
            {googleAuth ? (
              <button
                type="button"
                onClick={handleGoogleAdminUnlock}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] border border-[#4F46E5]/20 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <UserCheck size={15} />
                Unlock as Google Admin ({googleAuth.user.email})
              </button>
            ) : (
              <Link
                href="/login"
                className="w-full py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#EEF2FF] text-[#172554] border border-[#E2E8F0] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck size={14} className="text-[#4F46E5]" /> Sign In via Authorized Google Account
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const m = overview.metrics;
  const isSuperAdmin = overview.actor?.role === "super_admin";

  return (
    <div className="flex-1 bg-[#F8FAFC] py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Executive Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">
                <ShieldCheck size={12} /> GPay: {overview.gpay_number}
              </Badge>
              {overview.database && (
                <Badge tone={overview.database.persistent_cloud_db ? "indigo" : "warning"}>
                  <Database size={12} /> {overview.database.label}
                </Badge>
              )}
              {overview.actor?.role && (
                <Badge tone="navy" className="font-mono uppercase">
                  <ShieldAlert size={11} /> RBAC: {overview.actor.role}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554]">
              Executive Revenue, Users &amp; Security Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchOverview(adminToken)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#172554] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#4F46E5]" : "text-[#4F46E5]"} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLockPanel}
              className="px-3.5 py-2 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Lock &amp; Revoke Session
            </button>
          </div>
        </div>

        {/* 5 Real KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Verified Revenue"
            value={`₹${Number(m.total_revenue_inr).toLocaleString()}`}
            sublabel={`${m.approved_orders} approved passes`}
            icon={<IndianRupee size={18} />}
            accent="success"
          />
          <StatCard
            label="Pending Payments"
            value={m.pending_orders}
            sublabel={`₹${Number(m.pending_revenue_inr).toLocaleString()} awaiting review`}
            icon={<Clock size={18} />}
            accent="warning"
          />
          <StatCard
            label="Registered Users"
            value={m.total_users}
            sublabel={`${m.saved_forms || 0} saved option forms`}
            icon={<Users size={18} />}
            accent="indigo"
          />
          <StatCard
            label="Counselling Leads"
            value={m.total_leads}
            sublabel={`${m.new_leads} new callback requests`}
            icon={<FileText size={18} />}
            accent="navy"
          />
          <StatCard
            label="Security Alerts"
            value={m.security_alerts || 0}
            sublabel={`${auditSummary?.blocked || 0} blocked events`}
            icon={<ShieldAlert size={18} />}
            accent={(m.security_alerts || 0) > 0 ? "danger" : "success"}
          />
        </div>

        {/* Real-Data Visual Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#172554]">
                  Payment Orders Distribution
                </h2>
                <p className="text-xs text-[#64748B]">
                  Live status breakdown across {m.total_orders} database records
                </p>
              </div>
              <Badge tone="indigo">Live DB</Badge>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#4F46E5" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#172554]">
                  Security Monitoring Telemetry
                </h2>
                <p className="text-xs text-[#64748B]">
                  Persisted audit events by severity &amp; enforcement outcome
                </p>
              </div>
              <Badge tone="navy">Audit Trail</Badge>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={securityChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      borderColor: "#E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#172554" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Instant Manual Access Key Generator */}
        <form
          onSubmit={handleGenerateKey}
          className="bg-[#172554] text-white rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row items-stretch lg:items-end gap-4 shadow-xs"
        >
          <div className="flex-1 space-y-1">
            <div className="text-xs font-bold text-[#C7D2FE] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} /> Instant Access Key Generator
            </div>
            <p className="text-xs text-slate-300">
              Issue a pre-approved Pro (₹199) or VIP (₹499) key for direct GPay/WhatsApp buyers.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:w-[540px]">
            <input
              type="text"
              placeholder="Student Full Name"
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-300 focus:outline-none focus:border-[#C7D2FE]"
            />
            <input
              type="tel"
              placeholder="10-digit Phone"
              value={genPhone}
              onChange={(e) => setGenPhone(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono text-white placeholder:text-slate-300 focus:outline-none focus:border-[#C7D2FE]"
            />
            <select
              value={genPlan}
              onChange={(e) => setGenPlan(e.target.value as "pro" | "vip")}
              className="px-3.5 py-2.5 rounded-xl bg-[#1E3A8A] border border-white/15 text-xs font-semibold text-white focus:outline-none"
            >
              <option value="pro">CAP Pro (₹199)</option>
              <option value="vip">VIP 1-on-1 (₹499)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={genLoading}
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs shrink-0 cursor-pointer transition-colors"
          >
            {genLoading ? "Issuing..." : "Generate Approved Key"}
          </button>
        </form>

        {createdKey && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-emerald-900">
              Pre-Approved Access Key Issued:{" "}
              <strong className="font-mono text-sm ml-1">{createdKey}</strong>
            </div>
            <button
              type="button"
              onClick={() => copyText(createdKey)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === createdKey ? <Check size={13} /> : <Copy size={13} />}
              {copiedKey === createdKey ? "Copied" : "Copy Key"}
            </button>
          </div>
        )}

        {/* ENTERPRISE DATA TABLES CARD */}
        <Card className="overflow-hidden">
          {/* Tabs Bar */}
          <div className="px-5 pt-4 border-b border-[#E2E8F0] flex items-center gap-5 overflow-x-auto no-scrollbar">
            {[
              { id: "orders", label: `Payment Orders (${overview.orders.length})` },
              { id: "leads", label: `Counselling Leads (${overview.leads.length})` },
              { id: "users", label: `Users & RBAC (${overview.users?.length || 0})` },
              { id: "audit", label: `Security Audit Logs (${auditSummary?.total ?? auditLogs.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id as any);
                  if (t.id === "audit" && adminToken) {
                    fetchAuditLogs(adminToken, auditSeverity);
                  }
                }}
                className={`pb-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.id
                    ? "border-[#4F46E5] text-[#4F46E5]"
                    : "border-transparent text-[#64748B] hover:text-[#172554]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search, Filter & Sort Toolbar */}
          <div className="px-5 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={tableQuery}
                onChange={(e) => {
                  setTableQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={
                  tab === "orders"
                    ? "Search student, phone, UTR, or access key..."
                    : tab === "leads"
                    ? "Search lead name, phone, branch, or category..."
                    : tab === "users"
                    ? "Search student name, email, or category..."
                    : "Search event type, actor, IP, or details..."
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tab === "orders" && (
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1E293B]"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              )}

              {tab === "leads" && (
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1E293B]"
                >
                  <option value="all">All Leads</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="resolved">Resolved</option>
                </select>
              )}

              {tab === "users" && (
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs font-semibold text-[#1E293B]"
                >
                  <option value="all">All Roles</option>
                  <option value="student">Students</option>
                  <option value="counsellor">Counsellors</option>
                  <option value="admin">Admins</option>
                  <option value="super_admin">Super Admins</option>
                </select>
              )}

              {tab === "audit" && (
                <div className="flex items-center gap-1">
                  {(["", "critical", "warning", "info"] as const).map((sev) => (
                    <button
                      key={sev || "all"}
                      type="button"
                      onClick={() => {
                        setAuditSeverity(sev);
                        setPage(1);
                        if (adminToken) fetchAuditLogs(adminToken, sev);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize cursor-pointer border ${
                        auditSeverity === sev
                          ? "bg-[#172554] text-white border-[#172554]"
                          : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#172554]"
                      }`}
                    >
                      {sev || "All"}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSortAsc((p) => !p)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-[#EEF2FF] border border-[#E2E8F0] text-xs font-semibold text-[#172554] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowUpDown size={13} className="text-[#4F46E5]" />
                {sortAsc ? "Oldest First" : "Newest First"}
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading ? (
            <TableSkeleton rows={6} />
          ) : pagedRows.length === 0 ? (
            <EmptyState
              icon={tab === "audit" ? <Activity size={22} /> : <KeyRound size={22} />}
              title="No matching records found"
              description="Try clearing your search filter or switching status categories."
            />
          ) : (
            <>
              {/* TAB 1: PAYMENT ORDERS */}
              {tab === "orders" && (
                <>
                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-[#E2E8F0]">
                    {pagedRows.map((o: any) => (
                      <div key={o.id} className="p-4 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#172554]">{o.full_name}</div>
                            <div className="font-mono text-[#64748B]">{o.phone}</div>
                          </div>
                          <Badge
                            tone={
                              o.status === "approved"
                                ? "success"
                                : o.status === "pending"
                                ? "warning"
                                : "danger"
                            }
                            className="uppercase"
                          >
                            {o.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono text-[#64748B]">
                          <span className="font-bold text-[#4F46E5] uppercase">
                            {o.plan} • ₹{o.amount_inr}
                          </span>
                          <span>UTR: {o.utr_number}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => copyText(o.access_key)}
                            className="font-mono text-[11px] font-bold bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-1 rounded-lg"
                          >
                            {o.access_key}
                          </button>
                          <div className="flex gap-1.5">
                            {o.status !== "approved" && (
                              <button
                                type="button"
                                onClick={() => updateOrderStatus(o.id, "approved", o.access_key)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold"
                              >
                                Approve
                              </button>
                            )}
                            {o.status !== "rejected" && (
                              <button
                                type="button"
                                onClick={() => updateOrderStatus(o.id, "rejected", o.access_key)}
                                className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-semibold"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3 px-4">Student &amp; Phone</th>
                          <th className="py-3 px-4">Plan &amp; Amount</th>
                          <th className="py-3 px-4">UTR / Ref</th>
                          <th className="py-3 px-4">Access Key</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {pagedRows.map((o: any) => (
                          <tr key={o.id} className="hover:bg-[#F8FAFC]/80">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-[#172554]">{o.full_name}</div>
                              <a
                                href={`https://wa.me/91${o.phone}?text=${encodeURIComponent(
                                  `Hi ${o.full_name}! Your CAP Compass ${o.plan.toUpperCase()} Access Key is ${o.access_key}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-emerald-700 hover:underline inline-flex items-center gap-1 mt-0.5"
                              >
                                <MessageCircle size={11} /> {o.phone}
                              </a>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold">
                              <span className="uppercase text-[#4F46E5]">{o.plan}</span> • ₹{o.amount_inr}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#64748B]">{o.utr_number}</td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => copyText(o.access_key)}
                                className="font-mono font-semibold bg-[#F8FAFC] hover:bg-[#EEF2FF] px-2 py-1 rounded-lg border border-[#E2E8F0] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                {o.access_key}
                                {copiedKey === o.access_key ? (
                                  <Check size={11} className="text-emerald-600" />
                                ) : (
                                  <Copy size={11} className="text-[#64748B]" />
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge
                                tone={
                                  o.status === "approved"
                                    ? "success"
                                    : o.status === "pending"
                                    ? "warning"
                                    : "danger"
                                }
                                className="uppercase"
                              >
                                {o.status}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              {o.status !== "approved" && (
                                <button
                                  type="button"
                                  onClick={() => updateOrderStatus(o.id, "approved", o.access_key)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                              )}
                              {o.status !== "rejected" && (
                                <button
                                  type="button"
                                  onClick={() => updateOrderStatus(o.id, "rejected", o.access_key)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <XCircle size={13} /> Reject
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB 2: COUNSELLING LEADS */}
              {tab === "leads" && (
                <>
                  <div className="md:hidden divide-y divide-[#E2E8F0]">
                    {pagedRows.map((l: any) => (
                      <div key={l.id} className="p-4 space-y-2 text-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-[#172554]">{l.full_name}</div>
                            <div className="font-mono text-[#64748B]">{l.phone}</div>
                          </div>
                          <Badge
                            tone={
                              l.status === "resolved"
                                ? "success"
                                : l.status === "contacted"
                                ? "indigo"
                                : "warning"
                            }
                            className="uppercase"
                          >
                            {l.status}
                          </Badge>
                        </div>
                        <div className="text-[#4F46E5] font-semibold">
                          {l.preferred_branch || "Any Branch"} • {l.score_info || "-"} ({l.category || "-"})
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => updateLeadStatus(l.id, "contacted")}
                            className="px-2.5 py-1 rounded-lg bg-[#EEF2FF] text-[#4F46E5] font-semibold"
                          >
                            Contacted
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLeadStatus(l.id, "resolved")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold"
                          >
                            Resolved
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3 px-4">Student / Parent</th>
                          <th className="py-3 px-4">Score &amp; Category</th>
                          <th className="py-3 px-4">Branch &amp; Notes</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Update</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {pagedRows.map((l: any) => (
                          <tr key={l.id} className="hover:bg-[#F8FAFC]/80">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-[#172554]">{l.full_name}</div>
                              <a
                                href={`https://wa.me/91${l.phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-emerald-700 hover:underline inline-flex items-center gap-1"
                              >
                                <MessageCircle size={11} /> {l.phone}
                              </a>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <div className="text-[#172554] font-semibold">{l.score_info || "-"}</div>
                              <div className="text-[11px] text-[#64748B]">{l.category || "-"}</div>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <div className="font-semibold text-[#4F46E5]">{l.preferred_branch || "Any Branch"}</div>
                              <div className="text-[#64748B] line-clamp-2">{l.message || "-"}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge
                                tone={
                                  l.status === "resolved"
                                    ? "success"
                                    : l.status === "contacted"
                                    ? "indigo"
                                    : "warning"
                                }
                                className="uppercase"
                              >
                                {l.status}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => updateLeadStatus(l.id, "contacted")}
                                className="px-2.5 py-1 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] font-semibold cursor-pointer"
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB 3: USERS & RBAC */}
              {tab === "users" && (
                <>
                  <div className="md:hidden divide-y divide-[#E2E8F0]">
                    {pagedRows.map((u: any) => (
                      <div key={u.id} className="p-4 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#172554]">{u.full_name}</div>
                            <div className="font-mono text-[11px] text-[#64748B]">{u.email}</div>
                          </div>
                          <Badge tone={u.role === "super_admin" ? "navy" : "indigo"} className="uppercase font-mono">
                            {u.role || "student"}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B]">
                          {u.saved_category || "GOPENS"} • {u.bookmarks_count || 0} saved
                        </div>
                        {isSuperAdmin && (
                          <div className="flex items-center gap-2 pt-1">
                            <select
                              value={u.role || "student"}
                              disabled={roleBusyId === u.id}
                              onChange={(e) =>
                                handleUpdateUserRole(u, e.target.value, u.is_active !== false)
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-mono font-semibold"
                            >
                              <option value="student">student</option>
                              <option value="counsellor">counsellor</option>
                              <option value="admin">admin</option>
                              <option value="super_admin">super_admin</option>
                            </select>
                            <button
                              type="button"
                              disabled={roleBusyId === u.id}
                              onClick={() =>
                                handleUpdateUserRole(u, u.role || "student", u.is_active === false)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${
                                u.is_active === false
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {u.is_active === false ? "Activate" : "Suspend"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3 px-4">User &amp; Gmail</th>
                          <th className="py-3 px-4">RBAC Role &amp; Status</th>
                          <th className="py-3 px-4">Saved Profile</th>
                          <th className="py-3 px-4">Shortlist</th>
                          <th className="py-3 px-4">Last Sign-In</th>
                          {isSuperAdmin && <th className="py-3 px-4 text-right">RBAC Controls</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-xs">
                        {pagedRows.map((u: any) => (
                          <tr key={u.id} className="hover:bg-[#F8FAFC]/80">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-[#172554]">{u.full_name}</div>
                              <div className="text-[11px] font-mono text-[#64748B]">{u.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  tone={
                                    u.role === "super_admin"
                                      ? "navy"
                                      : u.role === "admin" || u.role === "counsellor"
                                      ? "indigo"
                                      : "neutral"
                                  }
                                  className="uppercase font-mono"
                                >
                                  {u.role || "student"}
                                </Badge>
                                {u.is_active === false && (
                                  <Badge tone="danger" className="uppercase">
                                    Suspended
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-semibold text-[#4F46E5]">
                                {u.saved_category || "GOPENS"}
                              </span>{" "}
                              • {u.saved_score != null ? u.saved_score : "-"}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-[#172554]">
                              {u.bookmarks_count || 0} colleges
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#64748B] text-[11px]">
                              {u.last_login_at
                                ? new Date(u.last_login_at).toLocaleString()
                                : "-"}
                            </td>
                            {isSuperAdmin && (
                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <select
                                    value={u.role || "student"}
                                    disabled={roleBusyId === u.id}
                                    onChange={(e) =>
                                      handleUpdateUserRole(
                                        u,
                                        e.target.value,
                                        u.is_active !== false
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-mono font-semibold text-[#172554]"
                                  >
                                    <option value="student">student</option>
                                    <option value="counsellor">counsellor</option>
                                    <option value="admin">admin</option>
                                    <option value="super_admin">super_admin</option>
                                  </select>
                                  <button
                                    type="button"
                                    disabled={roleBusyId === u.id}
                                    onClick={() =>
                                      handleUpdateUserRole(
                                        u,
                                        u.role || "student",
                                        u.is_active === false
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                                      u.is_active === false
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                    }`}
                                  >
                                    {u.is_active === false ? "Activate" : "Suspend"}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* TAB 4: SECURITY AUDIT LOGS */}
              {tab === "audit" && (
                <>
                  <div className="md:hidden divide-y divide-[#E2E8F0]">
                    {pagedRows.map((log: any) => (
                      <div key={log.id} className="p-4 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[#172554]">
                            {log.event_type}
                          </span>
                          <Badge
                            tone={
                              log.severity === "critical"
                                ? "danger"
                                : log.severity === "warning"
                                ? "warning"
                                : "neutral"
                            }
                            className="uppercase"
                          >
                            {log.severity}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B]">
                          {log.actor_identity || "anonymous"} • {log.ip_address || "-"} •{" "}
                          <span className="uppercase font-bold">{log.outcome}</span>
                        </div>
                        {log.details && (
                          <div className="text-[11px] text-[#64748B]">{log.details}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Severity</th>
                          <th className="py-3 px-4">Event</th>
                          <th className="py-3 px-4">Actor / Role</th>
                          <th className="py-3 px-4">Target</th>
                          <th className="py-3 px-4">IP &amp; Outcome</th>
                          <th className="py-3 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-[11px]">
                        {pagedRows.map((log: any) => (
                          <tr key={log.id} className="hover:bg-[#F8FAFC]/80">
                            <td className="py-2.5 px-4 font-mono text-[#64748B] whitespace-nowrap">
                              {log.created_at
                                ? new Date(log.created_at).toLocaleString()
                                : "-"}
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge
                                tone={
                                  log.severity === "critical"
                                    ? "danger"
                                    : log.severity === "warning"
                                    ? "warning"
                                    : "neutral"
                                }
                                className="uppercase"
                              >
                                {log.severity}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-[#172554]">
                              {log.event_type}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              <div className="text-[#1E293B]">{log.actor_identity || "anonymous"}</div>
                              {log.actor_role && (
                                <div className="text-[10px] text-[#64748B]">{log.actor_role}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[#64748B] max-w-[150px] truncate">
                              {log.target_resource || "-"}
                            </td>
                            <td className="py-2.5 px-4 font-mono">
                              <div className="text-[#64748B]">{log.ip_address || "-"}</div>
                              <span
                                className={`text-[10px] font-bold uppercase ${
                                  log.outcome === "blocked"
                                    ? "text-red-600"
                                    : log.outcome === "failure"
                                    ? "text-orange-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {log.outcome}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-[#64748B] max-w-xs truncate">
                              {log.details || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Pagination Footer */}
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                <span>
                  Showing{" "}
                  <strong className="text-[#172554]">
                    {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filteredRows.length)}
                  </strong>{" "}
                  of <strong className="text-[#172554]">{filteredRows.length}</strong> records
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#EEF2FF] cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono px-2 text-[#172554] font-semibold">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#EEF2FF] cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        title={confirmState?.title || ""}
        description={confirmState?.description || ""}
        confirmLabel={confirmState?.confirmLabel || "Confirm"}
        tone={confirmState?.tone || "primary"}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={async () => {
          if (!confirmState) return;
          setConfirmBusy(true);
          try {
            await confirmState.onConfirm();
          } finally {
            setConfirmBusy(false);
            setConfirmState(null);
          }
        }}
      />
    </div>
  );
}
