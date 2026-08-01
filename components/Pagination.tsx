'use client';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (count: number) => void;
}

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a2b4a] bg-[#0d1a30]/50">
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-400">
          Showing <span className="font-semibold text-slate-200">{startItem}</span> to <span className="font-semibold text-slate-200">{endItem}</span> of <span className="font-semibold text-slate-200">{totalItems}</span>
        </p>
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Rows:</span>
            <div className="flex items-center bg-[#0B1933] border border-[#1a2b4a] rounded-lg overflow-hidden">
              {[10, 25, 50].map((count) => (
                <button
                  key={count}
                  onClick={() => onItemsPerPageChange(count)}
                  className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    itemsPerPage === count
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
            currentPage === 1
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
          }`}
        >
          <i className="ri-skip-back-mini-line"></i>
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
            currentPage === 1
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
          }`}
        >
          <i className="ri-arrow-left-s-line"></i>
        </button>

        {getPageNumbers().map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-slate-600 text-sm">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentPage === page
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/50'
                  : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
            currentPage === totalPages
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
          }`}
        >
          <i className="ri-arrow-right-s-line"></i>
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer ${
            currentPage === totalPages
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:bg-[#1a2b4a] hover:text-white'
          }`}
        >
          <i className="ri-skip-forward-mini-line"></i>
        </button>
      </div>
    </div>
  );
}