'use client';

import { useState } from 'react';

interface HelpSectionProps {
  id: string;
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function HelpSection({ id, icon, title, children, defaultOpen = false }: HelpSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="bg-[#111d35] rounded-2xl border border-[#1e2d4d] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-[#0e1628] transition-colors cursor-pointer"
      >
        <div className="w-11 h-11 bg-teal-500/10 border border-teal-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <i className={`${icon} text-teal-400 text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white text-base">{title}</h3>
        </div>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <i className={`ri-${isOpen ? 'subtract' : 'add'}-line text-teal-400 text-lg transition-transform`} />
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-1 bg-[#0e1628] border-t border-[#1e2d4d]">
          <div className="pt-2 pl-14">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}