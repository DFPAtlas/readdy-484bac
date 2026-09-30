'use client';

export default function PendingCard() {
  return (
    <div className="w-full max-w-md mx-auto bg-[#111d35] border border-[#1e2d4d] rounded-3xl p-7 text-center shadow-xl shadow-black/20">
      <div className="relative w-16 h-16 mx-auto mb-5">
        <div className="absolute inset-0 rounded-2xl border-2 border-teal-500/20"></div>
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-teal-400 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className="ri-shield-check-line text-2xl text-teal-400"></i>
        </div>
      </div>
      <h1 className="text-lg font-bold text-white mb-2">Checking your SIA licence with the SIA register…</h1>
      <p className="text-sm text-slate-400">This usually takes under a minute.</p>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
        Checking automatically &mdash; no need to refresh
      </div>
    </div>
  );
}