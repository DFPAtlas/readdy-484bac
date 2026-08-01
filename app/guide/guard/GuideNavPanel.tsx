'use client';

import { useState, useEffect } from 'react';

const sections = [
  { id: 'step-01', icon: 'ri-user-add-line', label: 'Create Account' },
  { id: 'step-02', icon: 'ri-shield-check-line', label: 'SIA Verification' },
  { id: 'step-03', icon: 'ri-search-line', label: 'Find & Apply' },
  { id: 'step-04', icon: 'ri-money-pound-circle-line', label: 'Get Paid' },
  { id: 'best-practices', icon: 'ri-star-line', label: 'Best Practices' },
  { id: 'key-reminders', icon: 'ri-alarm-warning-line', label: 'Key Reminders' },
  { id: 'get-started', icon: 'ri-rocket-line', label: 'Get Started' },
];

export default function GuideNavPanel() {
  const [activeId, setActiveId] = useState('step-01');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.getBoundingClientRect().top <= 160) {
          setActiveId(sections[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
      }`}
    >
      <div className="bg-[#111d35] rounded-2xl shadow-2xl border border-slate-700/50 p-3 flex flex-col gap-1 w-52">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 pb-1 border-b border-slate-700/50 mb-1">
          Quick Navigation
        </p>
        {sections.map((s) => {
          const isActive = activeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer w-full ${
                isActive
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-400/20 shadow-sm'
                  : 'hover:bg-[#0e1628] text-slate-400'
              }`}
            >
              <div className={`w-6 h-6 flex items-center justify-center flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-500'}`}>
                <i className={`${s.icon} text-base`}></i>
              </div>
              <span className="text-xs font-semibold whitespace-nowrap">{s.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
