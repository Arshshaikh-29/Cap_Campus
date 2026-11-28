import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm max-w-lg w-full p-8 sm:p-10 text-center space-y-5">
        <div className="flex justify-center">
          <BrandLogo variant="icon" theme="light" size="xl" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-[11px] font-mono font-bold uppercase tracking-wider">
            404 • Route Not Found
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172554]">
            This page doesn&apos;t exist
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed">
            The college code or route you followed may have moved. Jump back into
            predicting colleges or browsing all 400 verified DTE institutes.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/?start=1"
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            Launch College Predictor <ArrowRight size={14} />
          </Link>
          <Link
            href="/explorer"
            className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Search size={14} /> Browse 400 Colleges
          </Link>
        </div>
        <div className="pt-3 border-t border-[#E2E8F0] flex justify-center">
          <BrandLogo variant="compact" theme="light" size="sm" />
        </div>
      </div>
    </div>
  );
}
