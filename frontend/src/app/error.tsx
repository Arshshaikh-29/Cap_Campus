"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg max-w-md w-full p-8 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-slate-900">
            Something went wrong
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            An unexpected display error occurred. Your shortlist and saved
            settings are safe — click retry to reload cleanly.
          </p>
        </div>
        <div className="flex gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <Home size={14} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
