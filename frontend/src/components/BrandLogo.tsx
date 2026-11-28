import React from "react";

interface BrandLogoProps {
  variant?: "primary" | "compact" | "icon";
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}

const MARK_SIZES = {
  sm: 28,
  md: 34,
  lg: 42,
  xl: 52,
};

const TEXT_CLASSES = {
  sm: "text-sm",
  md: "text-[15px]",
  lg: "text-lg",
  xl: "text-xl",
};

/**
 * Original geometric CAP Compass SVG brand mark:
 * Deep Navy (#172554) precision badge enclosing an abstract letter "C" ring
 * with a two-facet Royal Indigo (#4F46E5) & Soft Indigo (#EEF2FF) directional vector prism.
 */
export function BrandMark({
  theme = "light",
  size = 34,
  className = "",
}: {
  theme?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  const isDark = theme === "dark";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect
        width="40"
        height="40"
        rx="10"
        fill={isDark ? "#4F46E5" : "#172554"}
      />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        stroke={isDark ? "#EEF2FF" : "#4F46E5"}
        strokeOpacity={isDark ? 0.3 : 0.5}
        strokeWidth="1.5"
      />
      {/* Abstract Geometric C */}
      <path
        d="M27.6 12.4A10.8 10.8 0 1 0 27.6 27.6"
        stroke="#FFFFFF"
        strokeWidth="3.7"
        strokeLinecap="round"
      />
      {/* Directional Precision Prism (Upper & Lower Facets) */}
      <path
        d="M16.6 20L31.2 20L20.2 14.2L16.6 20Z"
        fill={isDark ? "#FFFFFF" : "#EEF2FF"}
      />
      <path
        d="M16.6 20L31.2 20L20.2 25.8L16.6 20Z"
        fill={isDark ? "#172554" : "#4F46E5"}
      />
      {/* Center Precision Pivot */}
      <circle cx="19.5" cy="20" r="2" fill={isDark ? "#EEF2FF" : "#FFFFFF"} />
    </svg>
  );
}

export default function BrandLogo({
  variant = "primary",
  theme = "light",
  size = "md",
  showTagline = false,
  className = "",
}: BrandLogoProps) {
  const markPx = MARK_SIZES[size];
  const isDark = theme === "dark";

  if (variant === "icon") {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="CAP Compass"
      >
        <BrandMark theme={theme} size={markPx} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <BrandMark theme={theme} size={markPx} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-extrabold tracking-tight whitespace-nowrap ${TEXT_CLASSES[size]} ${
            isDark ? "text-white" : "text-[#172554]"
          }`}
        >
          CAP{" "}
          <span className={isDark ? "text-[#C7D2FE]" : "text-[#4F46E5]"}>
            COMPASS
          </span>
        </span>
        {(showTagline || (variant === "primary" && (size === "lg" || size === "xl"))) && (
          <span
            className={`font-mono text-[9px] font-semibold uppercase tracking-[0.14em] mt-1 ${
              isDark ? "text-slate-300" : "text-[#64748B]"
            }`}
          >
            Admission Intelligence
          </span>
        )}
      </span>
    </span>
  );
}
