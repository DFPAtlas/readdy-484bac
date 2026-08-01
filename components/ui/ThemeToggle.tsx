'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const isDark = resolvedTheme === 'dark';

  const icon = mounted ? (
    theme === 'system' ? (
      <Monitor className="w-4 h-4 text-slate-400" />
    ) : theme === 'light' ? (
      <Sun className="w-4 h-4 text-amber-500" />
    ) : (
      <Moon className="w-4 h-4 text-indigo-400" />
    )
  ) : null;

  const label = mounted
    ? theme === 'system'
      ? 'Auto'
      : theme === 'light'
      ? 'Light'
      : 'Dark'
    : '';

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 cursor-pointer whitespace-nowrap"
      aria-label={`Theme: ${label}. Click to cycle.`}
      title={`Theme: ${label} — click to cycle`}
    >
      {mounted ? (
        <>
          <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
        </>
      ) : (
        <div className="w-4 h-4" />
      )}
    </button>
  );
}