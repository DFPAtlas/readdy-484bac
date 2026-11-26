const steps = ['Venue', 'When & Where', 'Requirements'];

export default function PostJobProgress({ step }: { step: number }) {
  return (
    <ol
      aria-label="Booking progress"
      className="mb-6 grid grid-cols-3 gap-2 list-none sm:mb-8 sm:gap-3"
    >
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = step > number;
        const current = step === number;
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`flex min-w-0 items-center gap-2 rounded-xl border px-2 py-2 sm:px-3 ${
              current
                ? 'border-red-400/60 bg-red-500/15'
                : complete
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.05]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                current
                  ? 'bg-red-600 text-white'
                  : complete
                    ? 'bg-emerald-500 text-[#06231a]'
                    : 'bg-white/10 text-slate-200'
              }`}
            >
              {complete ? <i className="ri-check-line"></i> : number}
            </span>
            <span
              className={`truncate text-[11px] font-semibold sm:text-sm ${
                current ? 'text-white' : complete ? 'text-emerald-100' : 'text-slate-200'
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}