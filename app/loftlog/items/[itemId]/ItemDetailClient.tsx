'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getItemById, getContainerById, getRackById } from '@/lib/loftlog/mock-data';
import { Item, ItemPhoto } from '@/lib/loftlog/types';

export default function ItemDetailClient({ itemId }: { itemId: string }) {
  const item = getItemById(itemId);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  if (!item) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-gray-400 text-2xl"></i>
          </div>
          <h2 className="text-lg font-semibold text-gray-700">Item not found</h2>
          <p className="text-sm text-gray-500 mt-1">This item may have been removed or the link is incorrect.</p>
          <Link href="/loftlog/items" className="inline-block mt-4 text-teal-600 hover:text-teal-700 font-medium text-sm">← Back to Items</Link>
        </div>
      </div>
    );
  }

  const container = item.containerId ? getContainerById(item.containerId) : undefined;
  const rack = item.rackId ? getRackById(item.rackId) : undefined;
  const activePhoto = item.photos[activePhotoIndex];
  const unacknowledgedWarnings = item.storageWarnings.filter(w => !w.acknowledged);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog/items" className="hover:text-gray-600 transition-colors">Items</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600 truncate">{item.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-20">
            <div className="aspect-[4/3] bg-gray-100 relative">
              {activePhoto ? (
                <img src={activePhoto.url} alt={activePhoto.caption} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="ri-image-line text-gray-300 text-5xl"></i>
                </div>
              )}
              {item.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setActivePhotoIndex(p => (p - 1 + item.photos.length) % item.photos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <i className="ri-arrow-left-s-line text-gray-600"></i>
                  </button>
                  <button
                    onClick={() => setActivePhotoIndex(p => (p + 1) % item.photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <i className="ri-arrow-right-s-line text-gray-600"></i>
                  </button>
                </>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {item.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhotoIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === activePhotoIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </div>

            {item.photos.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <div className="flex gap-2 overflow-x-auto">
                  {item.photos.map((photo, i) => (
                    <button
                      key={photo.id}
                      onClick={() => setActivePhotoIndex(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        i === activePhotoIndex ? 'border-teal-500' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={photo.thumbnailUrl || photo.url} alt="" className="w-full h-full object-cover object-top" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">{activePhotoIndex + 1} of {item.photos.length} · {activePhoto?.caption || 'No caption'}</p>
                  <div className="flex gap-1">
                    <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                      <i className="ri-refresh-line text-sm"></i>
                    </button>
                    <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                      <i className="ri-crop-line text-sm"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors whitespace-nowrap">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-pencil-line text-sm"></i></span>
                  Edit
                </button>
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors whitespace-nowrap"
                >
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-right-line text-sm"></i></span>
                  Move
                </button>
                <button
                  onClick={() => setShowLoanModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors whitespace-nowrap"
                >
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-share-forward-line text-sm"></i></span>
                  Loan
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-600 transition-colors whitespace-nowrap">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line text-sm"></i></span>
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={item.status} />
                  {item.decisionStatus && item.decisionStatus !== 'keep' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      {item.decisionStatus.charAt(0).toUpperCase() + item.decisionStatus.slice(1)}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{item.category}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${conditionColor(item.condition)}`}>
                    {item.condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {item.isImportant && <span className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center" title="Important"><i className="ri-star-fill text-yellow-500"></i></span>}
                {item.isSentimental && <span className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center" title="Sentimental"><i className="ri-heart-fill text-pink-500"></i></span>}
                {item.isSeasonal && <span className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center" title="Seasonal"><i className="ri-sun-fill text-cyan-500"></i></span>}
                {item.isFragile && <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center" title="Fragile"><i className="ri-alert-fill text-amber-500"></i></span>}
              </div>
            </div>

            {item.description && (
              <p className="text-sm text-gray-600 mt-4 leading-relaxed">{item.description}</p>
            )}

            {item.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {item.keywords.map(kw => (
                  <span key={kw} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{kw}</span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Location</h3>
            <div className="flex items-center gap-2 text-sm">
              {rack && (
                <>
                  <Link href={`/loftlog/map?rack=${rack.id}`} className="text-gray-600 hover:text-gray-800">
                    {rack.code} · {rack.label}
                  </Link>
                  <span className="w-4 h-4 flex items-center justify-center text-gray-300"><i className="ri-arrow-right-s-line text-sm"></i></span>
                </>
              )}
              {container && (
                <>
                  <Link href={`/loftlog/containers/${container.id}`} className="text-gray-600 hover:text-gray-800">
                    Shelf {container.shelf}, Position {container.position}
                  </Link>
                  <span className="w-4 h-4 flex items-center justify-center text-gray-300"><i className="ri-arrow-right-s-line text-sm"></i></span>
                  <Link href={`/loftlog/containers/${container.id}`} className="font-medium text-teal-600 hover:text-teal-700">
                    {container.code}
                  </Link>
                </>
              )}
              {!container && <span className="text-gray-400">No location assigned</span>}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Link href={`/loftlog/map?highlight=${item.id}`} className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium">
                <span className="w-4 h-4 flex items-center justify-center"><i className="ri-map-pin-line text-sm"></i></span>
                Show on Loft Map
              </Link>
              {container && (
                <Link href={`/loftlog/containers/${container.id}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
                  <span className="w-4 h-4 flex items-center justify-center"><i className="ri-archive-line text-sm"></i></span>
                  View Container
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Quantity" value={item.quantity > 1 ? `${item.quantity} (${item.unitType})` : item.unitType} />
            <DetailField label="Brand" value={item.brand || '—'} />
            <DetailField label="Model" value={item.model || '—'} />
            <DetailField label="Serial Number" value={item.serialNumber || '—'} mono />
            {item.dimensions && (
              <DetailField label="Dimensions" value={`${item.dimensions.width} × ${item.dimensions.height} × ${item.dimensions.depth} ${item.dimensions.unit}`} />
            )}
            {item.estimatedWeightKg && (
              <DetailField label="Est. Weight" value={`${item.estimatedWeightKg} kg`} />
            )}
            <DetailField label="Est. Value" value={item.estimatedValue ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency }).format(item.estimatedValue) : '—'} highlight />
            <DetailField label="Purchase Date" value={item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
            <DetailField label="Purchase Price" value={item.purchasePrice ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: item.currency }).format(item.purchasePrice) : '—'} />
            <DetailField label="Warranty Expiry" value={item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
          </div>

          {unacknowledgedWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 flex items-center justify-center"><i className="ri-error-warning-fill text-amber-600 text-lg"></i></span>
                <h3 className="text-sm font-semibold text-amber-800">Storage Suitability Warnings</h3>
              </div>
              <div className="space-y-2">
                {unacknowledgedWarnings.map((w, i) => (
                  <div key={i} className={`p-3 rounded-lg ${w.severity === 'severe' || w.severity === 'high' ? 'bg-red-100 border border-red-200' : 'bg-amber-100 border border-amber-200'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${w.severity === 'severe' ? 'bg-red-200 text-red-700' : w.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-200 text-amber-700'}`}>{w.severity}</span>
                      <p className="text-sm text-gray-700 flex-1">{w.message}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Awaiting acknowledgement</p>
                  </div>
                ))}
              </div>
              <button className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap">
                Acknowledge All Warnings
              </button>
            </div>
          )}

          {item.storageWarnings.filter(w => w.acknowledged).length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Acknowledged Warnings</h3>
              {item.storageWarnings.filter(w => w.acknowledged).map((w, i) => (
                <p key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-3 h-3 flex items-center justify-center"><i className="ri-check-line text-green-500 text-xs"></i></span>
                  {w.message}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Movement & Status History</h3>
              <button className="text-xs text-teal-600 hover:text-teal-700 font-medium">View Full History</button>
            </div>
            <div className="space-y-3">
              {item.movements.slice().reverse().map(mv => (
                <div key={mv.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${movementColor(mv.type)}`}>
                    <i className={`${movementIcon(mv.type)} text-white text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{mv.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      {mv.loanedTo && <> · Loaned to <span className="font-medium">{mv.loanedTo}</span></>}
                      {mv.loanExpectedReturn && <> · Expected return <span className="font-medium">{new Date(mv.loanExpectedReturn).toLocaleDateString('en-GB')}</span></>}
                      {mv.toContainerCode && <> · Moved to <span className="font-mono text-xs font-medium">{mv.toContainerCode}</span></>}
                    </p>
                    {mv.notes && <p className="text-xs text-gray-500 mt-0.5">{mv.notes}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(mv.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {mv.performedBy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dates</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Added:</span>
                <span className="ml-2 text-gray-700">{new Date(item.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div>
                <span className="text-gray-400">Last Verified:</span>
                <span className="ml-2 text-gray-700">{item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never'}</span>
              </div>
              <div>
                <span className="text-gray-400">Last Checked:</span>
                <span className="ml-2 text-gray-700">{item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never'}</span>
              </div>
              <div>
                <span className="text-gray-400">Updated:</span>
                <span className="ml-2 text-gray-700">{new Date(item.updatedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMoveModal && (
        <Modal onClose={() => setShowMoveModal(false)} title="Move Item">
          <p className="text-sm text-gray-600 mb-4">Select a new container for <strong>{item.name}</strong>.</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {[
              { id: 'c1', code: 'L-R01-S03-B01', label: 'Christmas Decorations' },
              { id: 'c2', code: 'L-R01-S02-B01', label: 'Power Tools' },
              { id: 'c3', code: 'L-R02-S02-B02', label: 'Camping Gear' },
            ].map(c => (
              <button key={c.id} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-colors">
                <p className="text-sm font-medium text-gray-800">{c.label}</p>
                <p className="text-xs text-gray-400 font-mono">{c.code}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">Confirm Move</button>
            <button onClick={() => setShowMoveModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}

      {showLoanModal && (
        <Modal onClose={() => setShowLoanModal(false)} title="Loan Item">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Loan to</label>
              <input type="text" placeholder="Person's name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected return date</label>
              <input type="date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" rows={2} placeholder="Optional notes..."></textarea>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">Confirm Loan</button>
            <button onClick={() => setShowLoanModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    in_storage: { color: 'bg-green-100 text-green-700', label: 'In Storage' },
    on_loan: { color: 'bg-indigo-100 text-indigo-700', label: 'On Loan' },
    removed: { color: 'bg-amber-100 text-amber-700', label: 'Removed' },
    missing: { color: 'bg-red-100 text-red-700', label: 'Missing' },
    sold: { color: 'bg-blue-100 text-blue-700', label: 'Sold' },
    donated: { color: 'bg-purple-100 text-purple-700', label: 'Donated' },
    disposed: { color: 'bg-gray-200 text-gray-600', label: 'Disposed' },
  };
  const info = map[status] || { color: 'bg-gray-100 text-gray-600', label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${info.color}`}>{info.label}</span>;
}

function conditionColor(condition: string) {
  const map: Record<string, string> = {
    new: 'bg-green-100 text-green-700',
    like_new: 'bg-emerald-100 text-emerald-700',
    good: 'bg-blue-100 text-blue-700',
    fair: 'bg-amber-100 text-amber-700',
    poor: 'bg-orange-100 text-orange-700',
    damaged: 'bg-red-100 text-red-700',
    for_parts: 'bg-gray-200 text-gray-600',
  };
  return map[condition] || 'bg-gray-100 text-gray-600';
}

function movementColor(type: string) {
  const map: Record<string, string> = {
    added: 'bg-green-500',
    moved: 'bg-blue-500',
    removed: 'bg-amber-500',
    loaned: 'bg-indigo-500',
    returned: 'bg-cyan-500',
    sold: 'bg-purple-500',
    donated: 'bg-pink-500',
    disposed: 'bg-gray-500',
    missing: 'bg-red-500',
    found: 'bg-green-500',
    verified: 'bg-teal-500',
    edited: 'bg-gray-400',
  };
  return map[type] || 'bg-gray-400';
}

function movementIcon(type: string) {
  const map: Record<string, string> = {
    added: 'ri-add-line',
    moved: 'ri-arrow-right-line',
    removed: 'ri-subtract-line',
    loaned: 'ri-share-forward-line',
    returned: 'ri-arrow-go-back-line',
    sold: 'ri-price-tag-3-line',
    donated: 'ri-hand-heart-line',
    disposed: 'ri-delete-bin-line',
    missing: 'ri-error-warning-line',
    found: 'ri-search-eye-line',
    verified: 'ri-check-line',
    edited: 'ri-pencil-line',
  };
  return map[type] || 'ri-record-circle-line';
}

function DetailField({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-sm ${highlight ? 'font-semibold text-teal-700' : 'text-gray-800'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}