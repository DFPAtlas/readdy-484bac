'use client';

import Link from 'next/link';
import CategoryBadge from './CategoryBadge';
import PriorityBadge from './PriorityBadge';

interface NotificationCardProps {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: number;
  is_read: boolean;
  created_at: string;
  link?: string;
  related_job_title?: string;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Bulk selection
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB');
}

export default function NotificationCard({
  id,
  title,
  message,
  category,
  priority,
  is_read,
  created_at,
  link,
  related_job_title,
  onMarkRead,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: NotificationCardProps) {
  const inner = (
    <div className="p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        {selectable && (
          <label className="flex items-center pt-1 cursor-pointer flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(id)}
              className="w-4 h-4 rounded border-[#1e2d4d] bg-[#162036] text-teal-500 focus:ring-teal-500/20 cursor-pointer"
            />
          </label>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <PriorityBadge priority={priority} />
            <CategoryBadge category={category} />
            {!is_read && (
              <span className="w-2 h-2 bg-teal-400 rounded-full" />
            )}
          </div>
          <h3 className={`text-sm font-semibold ${is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
            {title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{message}</p>
          {related_job_title && (
            <p className="text-xs text-teal-500 dark:text-teal-400 mt-1.5 font-medium">
              <i className="ri-briefcase-line mr-1"></i>
              {related_job_title}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-2 font-medium">{timeAgo(created_at)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative group rounded-xl border transition-all ${
      is_read
        ? 'bg-white dark:bg-[#111d35] border-slate-200 dark:border-[#1e2d4d]'
        : 'bg-teal-50 dark:bg-teal-500/5 border-teal-200 dark:border-teal-500/20'
    } ${selectable && selected ? 'ring-2 ring-teal-500/30' : ''}`}>
      {link && !selectable ? (
        <Link href={link} className="block">
          {inner}
        </Link>
      ) : (
        <div onClick={() => selectable && onToggleSelect?.(id)} className={selectable ? 'cursor-pointer' : ''}>
          {inner}
        </div>
      )}

      <div className={`flex items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5 ${selectable ? 'hidden' : ''}`}>
        {!is_read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead?.(id);
            }}
            className="text-xs font-semibold text-teal-500 dark:text-teal-400 hover:text-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-check-double-line mr-1"></i>
            Mark as Read
          </button>
        )}
        {link && (
          <Link
            href={link}
            className="text-xs font-semibold text-blue-500 dark:text-blue-400 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-right-line mr-1"></i>
            View
          </Link>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            className="text-xs font-semibold text-red-400 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap ml-auto"
          >
            <i className="ri-delete-bin-line mr-1"></i>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}