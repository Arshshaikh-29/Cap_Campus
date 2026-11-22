import Link from "next/link";
import { Compass, ArrowRight, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg max-w-lg w-full p-8 sm:p-10 text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-electric-blue/10 text-electric-blue flex items-center justify-center">
          <Compass size={28} />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-electric-blue">
            404 • Route Not Found
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            This CAP page doesn&apos;t exist
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The college code or page link you followed may have moved. Jump right
            back into predicting colleges or exploring verified cutoffs.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/?start=1"
            className="px-5 py-3 rounded-xl bg-electric-blue hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
          >
            Launch College Predictor <ArrowRight size={14} />
          </Link>
          <Link
            href="/explorer"
            className="px-5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Search size={14} /> Browse 380 Colleges
          </Link>
        </div>
        <p className="text-[11px] text-slate-400 pt-2">
          CAP Compass • Built by Arsh Shaikh
        </p>
      </div>
    </div>
  );
}
