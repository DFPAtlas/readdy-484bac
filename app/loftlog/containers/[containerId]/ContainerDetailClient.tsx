'use client';

import Link from 'next/link';
import { getContainerById, getItemsByContainer, getRackById } from '@/lib/loftlog/mock-data';

export default function ContainerDetailClient({ containerId }: { containerId: string }) {
  const container = getContainerById(containerId);

  if (!container) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-gray-700">Container not found</h2>
        <Link href="/loftlog/items" className="text-teal-600 hover:text-teal-700 text-sm mt-2 inline-block">← Back to Items</Link>
      </div>
    );
  }

  const items = getItemsByContainer(container.id);
  const rack = getRackById(container.rackId);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog/items" className="hover:text-gray-600 transition-colors">Items</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">{container.code}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{container.label}</h1>
            <p className="text-sm text-gray-400 font-mono mt-1">{container.code}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            container.status === 'catalogued' ? 'bg-green-100 text-green-700' :
            container.status === 'full' ? 'bg-amber-100 text-amber-700' :
            container.status === 'partial' ? 'bg-blue-100 text-blue-700' :
            container.status === 'empty' ? 'bg-gray-100 text-gray-500' :
            'bg-indigo-100 text-indigo-700'
          }`}>{container.status}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div><p className="text-xs text-gray-400">Rack</p><p className="text-sm text-gray-700">{rack?.code} · {rack?.label}</p></div>
          <div><p className="text-xs text-gray-400">Shelf</p><p className="text-sm text-gray-700">{container.shelf}</p></div>
          <div><p className="text-xs text-gray-400">Position</p><p className="text-sm text-gray-700">{container.position}</p></div>
          <div><p className="text-xs text-gray-400">Category</p><p className="text-sm text-gray-700">{container.category}</p></div>
          <div><p className="text-xs text-gray-400">Dimensions</p><p className="text-sm text-gray-700">{container.dimensions.width}×{container.dimensions.height}×{container.dimensions.depth} cm</p></div>
          <div><p className="text-xs text-gray-400">Load</p><p className="text-sm text-gray-700">{container.currentLoadKg}/{container.maxLoadKg} kg</p></div>
          <div><p className="text-xs text-gray-400">Last Checked</p><p className="text-sm text-gray-700">{container.lastCheckedAt ? new Date(container.lastCheckedAt).toLocaleDateString('en-GB') : 'Never'}</p></div>
          <div><p className="text-xs text-gray-400">Catalogued</p><p className="text-sm text-gray-700">{container.cataloguedAt ? new Date(container.cataloguedAt).toLocaleDateString('en-GB') : 'Not yet'}</p></div>
        </div>

        <div className="flex gap-2 mt-5">
          <Link href={`/loftlog/map?highlight=${container.id}`} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-map-pin-line text-sm"></i></span>
            Show on Map
          </Link>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-qr-scan-line text-sm"></i></span>
            Print Label
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Contents ({items.length} items)</h3>
          <Link href="/loftlog/items/add" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
            + Add Item
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-400">This container is empty.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <Link key={item.id} href={`/loftlog/items/${item.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.category} · Qty: {item.quantity}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    item.status === 'in_storage' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{item.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <span className="w-5 h-5 flex items-center justify-center text-gray-400"><i className="ri-arrow-right-s-line"></i></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}