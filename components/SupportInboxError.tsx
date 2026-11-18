export default function SupportInboxError({ onRetry }: { onRetry: () => void }) {
  return <main className="min-h-screen bg-[#0B1933] flex items-center justify-center p-6">
    <div role="alert" className="max-w-lg rounded-2xl border border-red-500/30 bg-[#111d35] p-8 text-center text-white">
      <h1 className="text-xl font-semibold mb-3">Support inbox unavailable</h1>
      <p className="text-slate-300 mb-5">We could not confirm your support account or load its tickets. Please retry.</p>
      <button type="button" onClick={onRetry} className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-slate-950">Retry support inbox</button>
      <a href="mailto:support@quickguard.uk" className="block mt-5 text-teal-300 underline">Email support</a>
    </div>
  </main>;
}
