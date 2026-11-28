"use client";

import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-[#172554]/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="animate-fade-in bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                tone === "danger"
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-[#EEF2FF] text-[#4F46E5] border border-[#4F46E5]/20"
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="text-base font-bold text-[#172554]"
              >
                {title}
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#1E293B] cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors disabled:opacity-50 ${
              tone === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#4F46E5] hover:bg-[#4338CA]"
            }`}
          >
            {busy ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
