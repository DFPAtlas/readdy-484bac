'use client';

import { useRouter } from 'next/navigation';

interface BackArrowProps {
  href?: string;
  label?: string;
  variant?: 'dark' | 'light';
}

export default function BackArrow({ href = '/', label = 'Back', variant = 'dark' }: BackArrowProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href === 'back') {
      router.back();
    } else {
      router.push(href);
    }
  };

  const colorClass = variant === 'dark'
    ? 'text-slate-400 hover:text-white'
    : 'text-gray-500 hover:text-gray-800';

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${colorClass}`}
    >
      <div className="w-8 h-8 flex items-center justify-center">
        <i className="ri-arrow-left-line text-lg"></i>
      </div>
      {label}
    </button>
  );
}