'use client';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

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
  cost: Cost;
  onEdit: (c: Cost) => void;
  onDelete: (id: string) => void;
}

export default function CostRow({ cost, onEdit, onDelete }: Props) {
  return (
    <tr className="hover:bg-[#162544] transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-white">{cost.service_name}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#1a2b4a] text-slate-300">
          {cost.category}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-white">{formatCurrency(cost.monthly_cost)}</td>
      <td className="px-4 py-3 text-sm text-slate-400">{cost.supplier || '-'}</td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {cost.billing_date
          ? new Date(cost.billing_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            })
          : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{cost.notes || '-'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(cost)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] text-slate-400 hover:text-white cursor-pointer"
          >
            <i className="ri-pencil-line"></i>
          </button>
          <button
            onClick={() => onDelete(cost.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-400/10 text-slate-400 hover:text-red-400 cursor-pointer"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}