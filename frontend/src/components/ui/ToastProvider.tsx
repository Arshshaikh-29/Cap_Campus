"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

export function showToast(
  title: string,
  variant: ToastVariant = "info",
  description?: string
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cap_toast", {
      detail: { title, variant, description },
    })
  );
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const next: ToastMessage = {
        id,
        title: String(detail.title || ""),
        description: detail.description ? String(detail.description) : undefined,
        variant: (detail.variant as ToastVariant) || "info",
      };
      setToasts((prev) => [...prev.slice(-3), next]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    };
    window.addEventListener("cap_toast", handler);
    return () => window.removeEventListener("cap_toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      className="fixed bottom-20 md:bottom-5 right-4 z-[80] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none print:hidden"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const iconMap = {
          success: <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />,
          error: <AlertCircle size={17} className="text-red-600 shrink-0 mt-0.5" />,
          warning: <AlertTriangle size={17} className="text-orange-600 shrink-0 mt-0.5" />,
          info: <Info size={17} className="text-[#4F46E5] shrink-0 mt-0.5" />,
        };
        const borderMap = {
          success: "border-emerald-200",
          error: "border-red-200",
          warning: "border-orange-200",
          info: "border-[#E2E8F0]",
        };
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-fade-in bg-white border ${borderMap[t.variant]} rounded-xl shadow-lg px-4 py-3 flex items-start gap-3`}
          >
            {iconMap[t.variant]}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#172554] leading-snug">
                {t.title}
              </div>
              {t.description && (
                <div className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                  {t.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="p-0.5 rounded-md text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
