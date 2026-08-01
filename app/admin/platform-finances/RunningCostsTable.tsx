'use client';

import { useState } from 'react';
import CostRow from './CostRow';

interface Cost {
  id: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  supplier: string;
  billing_date: string;
  notes: string;
}

interface Props {
  costs: Cost[];
  loading: boolean;
  onEdit: (c: Cost) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function RunningCostsTable({ costs, loading, onEdit, onDelete, onAdd }: Props) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(costs.length / perPage));
  const paged = costs.slice((page - 1) * perPage, page * perPage);
  const total = costs.reduce((sum, c) => sum + Number(c.monthly_cost), 0);

  return (
    <div className="bg-[#111d35] rounded-2xl border border-[#1e2d4a] shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Running Costs</h3>
          <p className="text-xs text-slate-400 mt-0.5">{costs.length} services</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-add-line"></i>
          </div>
          Add Cost
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#0d1b33]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Service</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Category</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Monthly Cost</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Supplier</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Billing Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Notes</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d4a]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="px-4 py-4">
                    <div className="h-4 bg-[#1a2b4a] rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  No running costs added yet
                </td>
              </tr>
            ) : (
              paged.map((c) => <CostRow key={c.id} cost={c} onEdit={onEdit} onDelete={onDelete} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-[#1e2d4a] flex items-center justify-between bg-[#0d1b33]">
        <span className="text-sm font-semibold text-white">
          Total:{' '}
          {new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
          }).format(total)}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}