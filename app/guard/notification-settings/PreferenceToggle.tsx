
'use client';

interface PreferenceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  icon: string;
  iconBg: string;
  iconColor: string;
  disabled?: boolean;
}

export default function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  icon,
  iconBg,
  iconColor,
  disabled = false,
}: PreferenceToggleProps) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
      checked ? 'border-teal-500/30 bg-teal-500/5' : 'border-[#1e2d4d] bg-[#0B1933]'
    } ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <i className={`${icon} text-lg ${iconColor}`}></i>
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only peer"
          disabled={disabled}
        />
        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
      </label>
    </div>
  );
}
