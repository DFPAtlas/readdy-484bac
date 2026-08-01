'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { mockContainers, mockCategories } from '@/lib/loftlog/mock-data';

type Step = 'container' | 'photos' | 'details' | 'review';

export default function AddItemClient() {
  const [step, setStep] = useState<Step>('container');
  const [form, setForm] = useState({
    containerId: '',
    name: '',
    description: '',
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    condition: 'good' as string,
    estimatedValue: '',
    purchaseDate: '',
    purchasePrice: '',
    keywords: '',
    isImportant: false,
    isSentimental: false,
    isSeasonal: false,
    isFragile: false,
  });
  const [photos, setPhotos] = useState<{ id: string; name: string; size: number }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateForm = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setPhotos(prev => [...prev, ...files.map((f, i) => ({ id: `new-${Date.now()}-${i}`, name: f.name, size: f.size }))]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...files.map((f, i) => ({ id: `new-${Date.now()}-${i}`, name: f.name, size: f.size }))]);
    }
  };

  const checkWarnings = () => {
    const ws: string[] = [];
    const name = form.name.toLowerCase();
    if (name.includes('battery') || name.includes('batteries')) ws.push('Batteries may degrade in loft temperatures');
    if (name.includes('paint') || name.includes('aerosol') || name.includes('spray')) ws.push('Paint and aerosols may be affected by temperature extremes');
    if (name.includes('gas') || name.includes('campingaz') || name.includes('canister')) ws.push('Gas canisters should not be stored in enclosed loft spaces');
    if (name.includes('document') || name.includes('certificate') || name.includes('passport')) ws.push('Valuable documents should have fireproof protection');
    setWarnings(ws);
    setStep('review');
  };

  const handleSave = () => {
    setSaved(true);
  };

  const resetForm = () => {
    setForm({
      containerId: form.containerId, name: '', description: '', category: '', brand: '', model: '',
      serialNumber: '', quantity: 1, condition: 'good', estimatedValue: '', purchaseDate: '',
      purchasePrice: '', keywords: '', isImportant: false, isSentimental: false, isSeasonal: false, isFragile: false,
    });
    setPhotos([]);
    setWarnings([]);
    setStep('photos');
    setSaved(false);
  };

  if (saved) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-green-600 text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Item Saved</h2>
          <p className="text-sm text-gray-500 mb-6">{form.name} has been added to your inventory.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/loftlog/items" className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors whitespace-nowrap">
              View Items
            </Link>
            <button onClick={resetForm} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
              Add Another Item
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog/items" className="hover:text-gray-600 transition-colors">Items</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Add Item</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Add New Item</h1>
      <p className="text-sm text-gray-500 mb-6">Step {step === 'container' ? '1' : step === 'photos' ? '2' : step === 'details' ? '3' : '4'} of 4</p>

      <div className="flex items-center gap-1 mb-8">
        {(['container', 'photos', 'details', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`h-2 rounded-full flex-1 transition-colors ${
              step === s ? 'bg-teal-500' : ['container', 'photos', 'details', 'review'].indexOf(step) > i ? 'bg-teal-300' : 'bg-gray-200'
            }`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 'container' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Destination Container</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
              {mockContainers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { updateForm('containerId', c.id); setStep('photos'); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    form.containerId === c.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-800">{c.label}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{c.code}</p>
                  <p className="text-xs text-gray-500 mt-1">Shelf {c.shelf}, Position {c.position}</p>
                  <p className="text-xs text-gray-400 mt-1 capitalize">{c.status} · {c.category}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-qr-scan-line text-sm"></i></span>
              You can also scan a box QR code in Mobile Quick Add mode.
            </p>
          </div>
        )}

        {step === 'photos' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload Photographs</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-image-add-line text-gray-400 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-600">Drag photos here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC up to 20MB each</p>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                      <i className="ri-image-line text-gray-300 text-2xl"></i>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 truncate">{photo.name}</p>
                    <button
                      onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="ri-close-line text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('container')} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 font-medium">
                ← Back
              </button>
              <button
                onClick={() => setStep('details')}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                Continue to Details
              </button>
            </div>
          </div>
        )}

        {step === 'details' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Item Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="e.g., Bosch Professional Drill GSB 18V-55"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Brief description of the item..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
                >
                  <option value="">Select category...</option>
                  {mockCategories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => updateForm('quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => updateForm('brand', e.target.value)}
                  placeholder="e.g., Bosch"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateForm('model', e.target.value)}
                  placeholder="e.g., GSB 18V-55"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={form.serialNumber}
                  onChange={(e) => updateForm('serialNumber', e.target.value)}
                  placeholder="Serial number"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
                <select
                  value={form.condition}
                  onChange={(e) => updateForm('condition', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-8"
                >
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                  <option value="for_parts">For Parts</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estimated Value (£)</label>
                <input
                  type="number"
                  value={form.estimatedValue}
                  onChange={(e) => updateForm('estimatedValue', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => updateForm('purchaseDate', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Price (£)</label>
                <input
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => updateForm('purchasePrice', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Keywords (comma separated)</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => updateForm('keywords', e.target.value)}
                  placeholder="drill, bosch, cordless, power tool"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-gray-500 mb-2 block">Flags</label>
                <div className="flex flex-wrap gap-2">
                  <FlagToggle active={form.isImportant} onChange={(v) => updateForm('isImportant', v)} icon="ri-star-fill" label="Important" activeColor="bg-yellow-100 text-yellow-700 border-yellow-300" />
                  <FlagToggle active={form.isSentimental} onChange={(v) => updateForm('isSentimental', v)} icon="ri-heart-fill" label="Sentimental" activeColor="bg-pink-100 text-pink-700 border-pink-300" />
                  <FlagToggle active={form.isSeasonal} onChange={(v) => updateForm('isSeasonal', v)} icon="ri-sun-fill" label="Seasonal" activeColor="bg-cyan-100 text-cyan-700 border-cyan-300" />
                  <FlagToggle active={form.isFragile} onChange={(v) => updateForm('isFragile', v)} icon="ri-alert-fill" label="Fragile" activeColor="bg-amber-100 text-amber-700 border-amber-300" />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('photos')} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 font-medium">
                ← Back
              </button>
              <button
                onClick={checkWarnings}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
              >
                Review & Save
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Review Before Saving</h2>

            <div className="space-y-3 mb-4">
              <ReviewRow label="Container" value={mockContainers.find(c => c.id === form.containerId)?.code || '—'} />
              <ReviewRow label="Name" value={form.name || '—'} highlight />
              <ReviewRow label="Description" value={form.description || '—'} />
              <ReviewRow label="Category" value={form.category || '—'} />
              <ReviewRow label="Quantity" value={String(form.quantity)} />
              <ReviewRow label="Brand" value={form.brand || '—'} />
              <ReviewRow label="Model" value={form.model || '—'} />
              <ReviewRow label="Serial" value={form.serialNumber || '—'} />
              <ReviewRow label="Condition" value={form.condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} />
              <ReviewRow label="Value" value={form.estimatedValue ? `£${form.estimatedValue}` : '—'} />
              <ReviewRow label="Photos" value={photos.length > 0 ? `${photos.length} uploaded` : 'None'} />
            </div>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 flex items-center justify-center"><i className="ri-error-warning-fill text-amber-600"></i></span>
                  <h3 className="text-sm font-semibold text-amber-800">Storage Suitability Warnings</h3>
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-error-warning-line text-xs"></i></span>
                      {w}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-500 mt-2">These are advisory warnings. You can still save the item after acknowledging.</p>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep('details')} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 font-medium">
                ← Back
              </button>
              <div className="flex gap-2">
                <button onClick={handleSave} className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
                  Save Item
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlagToggle({ active, onChange, icon, label, activeColor }: {
  active: boolean;
  onChange: (v: boolean) => void;
  icon: string;
  label: string;
  activeColor: string;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
        active ? activeColor : 'border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      <span className="w-4 h-4 flex items-center justify-center"><i className={`${icon} text-sm`}></i></span>
      {label}
    </button>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}