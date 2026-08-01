interface ChecklistItem {
  label: string;
  checked: boolean;
  icon?: string;
}

interface ChecklistProgressProps {
  title?: string;
  items: ChecklistItem[];
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'teal';
  showList?: boolean;
  progressOnly?: boolean;
  bare?: boolean;
}

const colorMap = {
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', subtext: 'text-blue-400/80', fill: 'bg-blue-500', icon: 'text-blue-400' },
  green: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', subtext: 'text-emerald-400/80', fill: 'bg-emerald-500', icon: 'text-emerald-400' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', subtext: 'text-purple-400/80', fill: 'bg-purple-500', icon: 'text-purple-400' },
  amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', subtext: 'text-amber-400/80', fill: 'bg-amber-500', icon: 'text-amber-400' },
  teal: { bg: 'bg-teal-500/5', border: 'border-teal-500/20', text: 'text-teal-400', subtext: 'text-teal-400/80', fill: 'bg-teal-500', icon: 'text-teal-400' },
};

export default function ChecklistProgress({
  title = 'Verification Progress',
  items,
  color = 'blue',
  showList = false,
  progressOnly = false,
  bare = false,
}: ChecklistProgressProps) {
  const c = colorMap[color] || colorMap.blue;
  const total = items.length;
  const completed = items.filter(i => i.checked).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (bare) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <span className="text-xs font-bold text-amber-400">{pct}%</span>
        </div>
        <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden">
          <div
            className={`h-full ${c.fill} rounded-full transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <i className={`ri-information-line ${c.icon} text-xl mt-0.5 w-5 h-5 flex items-center justify-center`}></i>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-medium ${c.text}`}>{title}</p>
            <p className={`text-sm font-semibold ${c.subtext}`}>{completed} of {total}</p>
          </div>
          <div className="w-full h-2 bg-[#1a2b4a] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${c.fill} rounded-full transition-all duration-300`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className={`text-xs ${c.subtext}`}>{completed} of {total} items completed</p>

          {showList && (
            <div className="mt-3 space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <i className={`${item.checked ? 'ri-checkbox-circle-fill text-emerald-400' : 'ri-checkbox-blank-circle-line text-slate-500'} w-4 h-4 flex items-center justify-center`}></i>
                  {item.icon && <i className={`${item.icon} w-4 h-4 flex items-center justify-center text-slate-500`}></i>}
                  <span className={item.checked ? 'text-slate-200' : 'text-slate-500'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}