"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm max-w-md w-full p-8 text-center space-y-5">
        <div className="flex justify-center">
          <BrandLogo variant="compact" theme="light" size="sm" />
        </div>
        <div className="w-12 h-12 mx-auto rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center">
          <AlertTriangle size={22} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-[#172554]">
            Something went wrong
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            An unexpected display error occurred. Your shortlist and saved
            settings are safe — retry to reload cleanly.
          </p>
        </div>
        <div className="flex gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Home size={14} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
