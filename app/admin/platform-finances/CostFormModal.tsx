'use client';

import { useState, useEffect } from 'react';

const categories = [
  'Hosting',
  'Supabase',
  'Stripe',
  'Domain',
  'Email',
  'AI Services',
  'SMS/Check Calls',
  'Storage',
  'Backups',
  'Marketing',
  'Accountancy',
  'Other',
];

interface Cost {
  id?: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  supplier: string;
  billing_date: string;
  notes: string;
}

interface Props {
  open: boolean;
  cost: Cost | null;
  onClose: () => void;
  onSave: (c: Cost) => void;
  isSaving: boolean;
}

export default function CostFormModal({ open, cost, onClose, onSave, isSaving }: Props) {
  const [form, setForm] = useState<Cost>({
    service_name: '',
    category: 'Hosting',
    monthly_cost: 0,
    supplier: '',
    billing_date: '',
    notes: '',
  });

  useEffect(() => {
    if (cost) {
      setForm(cost);
    } else {
      setForm({
        service_name: '',
        category: 'Hosting',
        monthly_cost: 0,
        supplier: '',
        billing_date: '',
        notes: '',
      });
    }
  }, [cost, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-[#1e2d4a]">
        <div className="px-6 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {cost ? 'Edit Cost' : 'Add Running Cost'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white cursor-pointer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Service Name</label>
            <input
              required
              value={form.service_name}
              onChange={(e) => setForm({ ...form, service_name: e.target.value })}
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    form.category === c
                      ? 'bg-teal-500 text-white'
                      : 'bg-[#1a2b4a] text-slate-400 hover:bg-[#223456] hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Monthly Cost</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.monthly_cost}
                onChange={(e) => setForm({ ...form, monthly_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Supplier</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Billing Date</label>
            <input
              type="date"
              value={form.billing_date}
              onChange={(e) => setForm({ ...form, billing_date: e.target.value })}
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1e2d4a] rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#1e2d4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}