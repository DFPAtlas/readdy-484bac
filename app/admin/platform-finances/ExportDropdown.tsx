'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  payments: any[];
  dateRange: string;
}

export default function ExportDropdown({ payments, dateRange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const exportCSV = () => {
    const headers = 'Date,Customer,Email,Plan,Amount,Stripe Fee,Net Amount,Status,Invoice ID\n';
    const rows = payments
      .map((p) => {
        const date = new Date(p.date).toLocaleDateString('en-GB');
        const customer = `"${(p.customer || '').replace(/"/g, '""')}"`;
        const email = `"${(p.email || '').replace(/"/g, '""')}"`;
        const plan = `"${(p.plan || '').replace(/"/g, '""')}"`;
        return `${date},${customer},${email},${plan},${p.amount},${p.stripe_fee},${p.net_amount},${p.status},${p.invoice_id}`;
      })
      .join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickguard-payments-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const printReport = () => {
    window.print();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className="ri-download-line"></i>
        </div>
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#111d35] rounded-xl shadow-lg border border-[#1e2d4a] py-2 z-10">
          <button
            onClick={exportCSV}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-file-text-line"></i>
            </div>
            Export CSV
          </button>
          <button
            onClick={printReport}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-[#1a2b4a] cursor-pointer flex items-center gap-2"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-printer-line"></i>
            </div>
            Print Report
          </button>
        </div>
      )}
    </div>
  );
}