interface VenueCardProps {
  label: string;
  desc: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}

export default function VenueCard({ label, desc, icon, selected, onSelect }: VenueCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative flex w-full min-w-0 items-start gap-3 rounded-2xl border p-4 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1933] ${
        selected
          ? 'border-red-400/70 bg-red-500/15'
          : 'border-white/10 bg-white/[0.05] hover:border-red-400/40 hover:bg-white/[0.08]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
          selected
            ? 'border-red-400/40 bg-red-500/20 text-red-100'
            : 'border-white/10 bg-white/[0.07] text-slate-200 group-hover:text-red-100'
        }`}
      >
        <i className={`${icon} text-lg`}></i>
      </span>
      <span className="min-w-0 pr-4">
        <span className={`block text-sm font-semibold ${selected ? 'text-white' : 'text-slate-100'}`}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-slate-300">{desc}</span>
      </span>
      {selected ? (
        <i
          aria-hidden="true"
          className="ri-checkbox-circle-fill absolute right-3 top-3 text-red-300"
        ></i>
      ) : null}
    </button>
  );
}