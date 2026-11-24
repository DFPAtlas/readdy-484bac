'use client';

import { GUARD_DISPLAY_PAGE_SIZE } from '@/lib/admin-guard-list';

interface Props {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export default function GuardListPagination({ page, totalItems, onPageChange, disabled = false }: Props) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / GUARD_DISPLAY_PAGE_SIZE));
  const start = (page - 1) * GUARD_DISPLAY_PAGE_SIZE + 1;
  const end = Math.min(page * GUARD_DISPLAY_PAGE_SIZE, totalItems);
  return (
    <nav aria-label="Guard list pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200">
      <p role="status" className="text-sm">Showing {start}–{end} of {totalItems} guards · Page {page} of {totalPages}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}
          className="rounded-lg border border-slate-400/50 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous page</button>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages}
          className="rounded-lg border border-slate-400/50 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next page</button>
      </div>
    </nav>
  );
}
