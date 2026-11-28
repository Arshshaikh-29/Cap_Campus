import React from "react";
import { RefreshCw } from "lucide-react";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "navy" | "secondary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants = {
    primary:
      "bg-[#4F46E5] hover:bg-[#4338CA] text-white border border-transparent shadow-xs",
    navy: "bg-[#172554] hover:bg-[#1E3A8A] text-white border border-transparent shadow-xs",
    secondary:
      "bg-white hover:bg-[#F8FAFC] text-[#1E293B] border border-[#E2E8F0] shadow-2xs",
    soft: "bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4F46E5] border border-[#4F46E5]/15",
    ghost: "bg-transparent hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#172554]",
    danger:
      "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2",
    lg: "px-5 py-3 text-sm rounded-xl gap-2",
  };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <RefreshCw size={14} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(23,37,84,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  tone = "indigo",
  className = "",
  children,
}: {
  tone?: "indigo" | "navy" | "neutral" | "success" | "warning" | "danger";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    indigo: "bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/20",
    navy: "bg-[#172554] text-white border-[#172554]",
    neutral: "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-orange-50 text-orange-700 border-orange-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "navy" | "success" | "warning" | "danger";
}) {
  const iconStyles = {
    indigo: "bg-[#EEF2FF] text-[#4F46E5]",
    navy: "bg-[#172554]/8 text-[#172554]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-orange-50 text-orange-600",
    danger: "bg-red-50 text-red-600",
  };
  return (
    <Card className="p-5 hover:border-[#CBD5E1] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-[#172554] mt-1.5 tracking-tight">
            {value}
          </div>
          {sublabel && (
            <div className="text-xs text-[#64748B] mt-1 truncate">{sublabel}</div>
          )}
        </div>
        {icon && (
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyles[accent]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="space-y-1.5 max-w-2xl">
        {eyebrow && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/15 text-[11px] font-semibold">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172554] tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[#64748B] leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12 px-6 text-center flex flex-col items-center justify-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-bold text-[#172554]">{title}</h3>
        <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-xl bg-[#F1F5F9] animate-pulse w-full"
        />
      ))}
    </div>
  );
}
