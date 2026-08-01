'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mockItems, mockContainers } from '@/lib/loftlog/mock-data';

export default function InventoryWorkspace() {
  const [view, setView] = useState<'items' | 'containers' | 'both'>('both');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedItemIds(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Workspace</h1>
          <p className="text-sm text-gray-500 mt-1">{mockItems.length} items · {mockContainers.length} containers</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['both', 'items', 'containers'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  view === v ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'both' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {selectedItemIds.size > 0 && (
            <>
              <button className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
                Bulk Edit ({selectedItemIds.size})
              </button>
              <button className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
                Bulk Move
              </button>
              <button className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors whitespace-nowrap">
                Export
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" className="rounded" onChange={(e) => {
                    if (e.target.checked) setSelectedItemIds(new Set(mockItems.map(i => i.id)));
                    else setSelectedItemIds(new Set());
                  }} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Decision</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Checked</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockItems.map(item => (
                <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedItemIds.has(item.id) ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItem(item.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/loftlog/items/${item.id}`} className="font-medium text-gray-900 hover:text-teal-600 transition-colors">{item.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.category}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.containerCode || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      item.status === 'in_storage' ? 'bg-green-100 text-green-700' :
                      item.status === 'missing' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{item.decisionStatus || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.estimatedValue ? `£${item.estimatedValue}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString('en-GB') : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <i className="ri-pencil-line text-xs"></i>
                      </button>
                      <Link href={`/loftlog/items/${item.id}`} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <i className="ri-arrow-right-line text-xs"></i>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}