export const GPAY_NUMBER = "9920627188";
export const WHATSAPP_NUMBER = "919920627188";

export type PlanTier = "free" | "pro" | "vip";

export interface PlanSession {
  plan: PlanTier;
  accessKey?: string;
  entitlementToken?: string;
  fullName?: string;
  status?: "pending" | "approved" | "rejected";
  requestedPlan?: "pro" | "vip";
  utrNumber?: string;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  priceInr: number;
  tagline: string;
  badge?: string;
  validity: string;
  features: string[];
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  free: {
    id: "free",
    name: "Starter Free",
    priceInr: 0,
    tagline: "Essential cutoff explorer & quick college lookup",
    validity: "Always Free",
    features: [
      "Top 12 College Predictions with Dual Rank & %ile Cutoffs",
      "Live MHT-CET Percentile ↔ State Merit Rank Calculator",
      "Browse all 380 Maharashtra Engineering Colleges",
      "Preview Top 10 Smart CAP Option Form Choices",
      "Compare up to 2 Colleges Side-by-Side",
    ],
  },
  pro: {
    id: "pro",
    name: "CAP Pro Pass",
    priceInr: 199,
    tagline: "Complete toolkit for winning Rounds 1, 2, 3 & Spot",
    badge: "Most Popular",
    validity: "One-time • Valid full 2026 CAP season",
    features: [
      "Unlimited College Predictions (All 300+ matched courses)",
      "Full Smart CAP Option Form Builder (up to 60 ordered DTE choices)",
      "Full CAP Betterment & Spot-Round Drop Radar (All R1→R3 gems + ACAP watchlist)",
      "Full Scholarship, Net-Fee Budget & ROI Finder (Custom Max-Budget + PDF/CSV)",
      "Compare up to 4 Colleges Side-by-Side with NIRF Placements & FRA Fees",
      "Unlimited CET-Ready CSV & Printable PDF Preference Exports",
    ],
  },
  vip: {
    id: "vip",
    name: "Counselling VIP + 1-on-1",
    priceInr: 499,
    tagline: "Everything in Pro + personal mentor review on WhatsApp/Call",
    badge: "Personal Guidance",
    validity: "One-time • Full Season + Dedicated WhatsApp Support",
    features: [
      "Everything included in CAP Pro Pass (Option Form, Betterment Radar & ROI Finder)",
      "Personal 1-on-1 Option Form Audit by CAP Counselling Experts",
      "Direct WhatsApp & Call Priority Support (Rounds 1–3)",
      "Spot Round (ACAP) & Institute-Level Seat (ILS) Strategy Plan",
      "Custom TFWS / Girls 100% Waiver / EWS / Minority Optimization",
    ],
  },
};

const STORAGE_KEY = "cap_compass_plan_session";

export function getStoredPlan(): PlanSession {
  if (typeof window === "undefined") return { plan: "free" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { plan: "free" };
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.plan === "free" || parsed.plan === "pro" || parsed.plan === "vip")) {
      return parsed;
    }
    return { plan: "free" };
  } catch {
    return { plan: "free" };
  }
}

export function saveStoredPlan(session: PlanSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event("cap_plan_updated"));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredPlan() {
  saveStoredPlan({ plan: "free" });
}

export function isProActive(session: PlanSession | null | undefined): boolean {
  return Boolean(
    session &&
      (session.plan === "pro" || session.plan === "vip") &&
      typeof session.entitlementToken === "string" &&
      session.entitlementToken.startsWith("v1.")
  );
}

/**
 * Neutralizes Excel/Google Sheets CSV Formula Injection (=, +, -, @, tab, CR).
 */
export function escapeCSVCell(val: unknown): string {
  let str = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function openUpgradeModal(
  defaultPlan: "pro" | "vip" = "pro",
  reason?: string
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cap_open_upgrade_modal", {
      detail: { plan: defaultPlan, reason },
    })
  );
}

export function buildWhatsAppGPayUrl(params: {
  planName: string;
  amountInr: number;
  fullName?: string;
  utrNumber?: string;
  accessKey?: string;
}): string {
  const lines = [
    `Hi CAP Compass Team! I just paid ₹${params.amountInr} via Google Pay (${GPAY_NUMBER}) for ${params.planName}.`,
  ];
  if (params.fullName) lines.push(`Name: ${params.fullName}`);
  if (params.utrNumber) lines.push(`GPay UTR / Txn ID: ${params.utrNumber}`);
  if (params.accessKey) lines.push(`Access Key: ${params.accessKey}`);
  lines.push("Please verify & activate my account.");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
