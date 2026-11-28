import React from "react";
import BrandLogo from "@/components/BrandLogo";

export default function Loading() {
  return (
    <div
      className="flex-1 min-h-[60vh] bg-[#F8FAFC] flex flex-col items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs px-8 py-7 flex flex-col items-center gap-4">
        <BrandLogo variant="primary" theme="light" size="lg" showTagline />
        <div className="w-44 h-1.5 rounded-full bg-[#EEF2FF] overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-[#4F46E5] animate-pulse" />
        </div>
        <p className="text-xs font-medium text-[#64748B]">
          Loading CAP Compass workspace...
        </p>
      </div>
    </div>
  );
}
