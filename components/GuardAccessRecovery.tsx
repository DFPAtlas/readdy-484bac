import Link from 'next/link';

export default function GuardAccessRecovery({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-6">
      <div role="alert" className="max-w-lg rounded-2xl border border-amber-500/25 bg-[#111d35] p-8 text-slate-300">
        <h1 className="text-xl font-bold text-white">Guard access could not be verified</h1>
        <p className="mt-3">Retry the access check. If your session has ended, use the normal guard sign-in.</p>
        <div className="mt-6 flex flex-wrap gap-4 items-center">
          <button onClick={onRetry} className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-slate-950">Retry access check</button>
          <Link href="/guard/login" className="text-teal-300 underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
