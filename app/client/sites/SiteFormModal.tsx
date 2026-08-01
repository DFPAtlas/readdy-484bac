'use client';

import { useState } from 'react';

interface SavedSite {
  id: string;
  site_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  site_contact_email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  access_instructions?: string;
  parking_details?: string;
  risk_notes?: string;
  key_entry_instructions?: string;
  patrol_expectations?: string;
  uniform_requirements?: string;
  cctv_details?: string;
  status?: string;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SiteFormModalProps {
  site?: SavedSite | null;
  onSave: (form: any) => void;
  onClose: () => void;
  saving: boolean;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', colour: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { value: 'inactive', label: 'Inactive', colour: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  { value: 'needs_info', label: 'Needs Info', colour: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
];

const TABS = [
  { key: 'details', label: 'Site Details', icon: 'ri-building-line' },
  { key: 'contacts', label: 'Contacts', icon: 'ri-contacts-line' },
  { key: 'instructions', label: 'Instructions & Notes', icon: 'ri-file-list-line' },
] as const;

export default function SiteFormModal({ site, onSave, onClose, saving }: SiteFormModalProps) {
  const [form, setForm] = useState({
    site_name: site?.site_name || '',
    address_line1: site?.address_line1 || '',
    address_line2: site?.address_line2 || '',
    city: site?.city || '',
    postcode: site?.postcode || '',
    site_contact_name: site?.site_contact_name || '',
    site_contact_phone: site?.site_contact_phone || '',
    site_contact_email: site?.site_contact_email || '',
    emergency_contact_name: site?.emergency_contact_name || '',
    emergency_contact_phone: site?.emergency_contact_phone || '',
    access_instructions: site?.access_instructions || '',
    key_entry_instructions: site?.key_entry_instructions || '',
    parking_details: site?.parking_details || '',
    risk_notes: site?.risk_notes || '',
    patrol_expectations: site?.patrol_expectations || '',
    uniform_requirements: site?.uniform_requirements || '',
    cctv_details: site?.cctv_details || '',
    status: site?.status || 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'contacts' | 'instructions'>('details');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!form.site_name.trim()) newErrors.site_name = 'Site name is required';
    if (!form.address_line1.trim()) newErrors.address_line1 = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.postcode.trim()) newErrors.postcode = 'Postcode is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setActiveTab('details');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#1e2d4d] shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#1e2d4d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/25">
              <i className="ri-building-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{site ? 'Edit Site' : 'Add Saved Site'}</h2>
              <p className="text-sm text-slate-500">Store site details for quick reuse</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 bg-[#162036] p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-[#111d35] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <i className={tab.icon}></i>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Site Name *</label>
                <input name="site_name" value={form.site_name} onChange={handleChange} placeholder="e.g., Westfield London, The O2 Arena"
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                {errors.site_name && <p className="text-red-400 text-sm mt-1">{errors.site_name}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 1 *</label>
                  <input name="address_line1" value={form.address_line1} onChange={handleChange} placeholder="Street address"
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  {errors.address_line1 && <p className="text-red-400 text-sm mt-1">{errors.address_line1}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 2</label>
                  <input name="address_line2" value={form.address_line2} onChange={handleChange} placeholder="Building, floor, suite..."
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">City *</label>
                  <input name="city" value={form.city} onChange={handleChange} placeholder="e.g., London"
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Postcode *</label>
                  <input name="postcode" value={form.postcode} onChange={handleChange} placeholder="e.g., SW1A 1AA"
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  {errors.postcode && <p className="text-red-400 text-sm mt-1">{errors.postcode}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">Site Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(prev => ({ ...prev, status: opt.value }))}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        form.status === opt.value ? `${opt.bg} ${opt.border}` : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${form.status === opt.value ? opt.colour : 'text-slate-400'}`}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Site Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Name</label>
                    <input name="site_contact_name" value={form.site_contact_name} onChange={handleChange} placeholder="e.g., John Smith"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Phone</label>
                    <input name="site_contact_phone" value={form.site_contact_phone} onChange={handleChange} placeholder="07XXX XXXXXX"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
                    <input name="site_contact_email" value={form.site_contact_email} onChange={handleChange} placeholder="contact@site.com"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  </div>
                </div>
              </div>
              <div className="border-t border-[#1e2d4d] pt-5">
                <h3 className="text-sm font-semibold text-white mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Name</label>
                    <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="e.g., Security Control Room"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Phone</label>
                    <input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} placeholder="020 XXXX XXXX"
                      className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4">
              {[
                { name: 'access_instructions', label: 'Access Instructions', max: 500, placeholder: 'Entry codes, key collection, security desk check-in, reception details...' },
                { name: 'key_entry_instructions', label: 'Key / Entry Instructions', max: 300, placeholder: 'Key safe code, fob collection, who holds keys, lockbox details...' },
                { name: 'parking_details', label: 'Parking Details', max: 300, placeholder: 'Visitor parking, nearest car park, loading bay, permit requirements...' },
                { name: 'patrol_expectations', label: 'Patrol Expectations', max: 300, placeholder: 'Internal patrols, external rounds, specific checkpoints, frequency...' },
                { name: 'uniform_requirements', label: 'Uniform Requirements', max: 300, placeholder: 'Black suit, hi-vis, branded jacket, smart casual, PPE requirements...' },
                { name: 'cctv_details', label: 'CCTV / Control Room Details', max: 300, placeholder: 'CCTV monitored, control room location, number to call, monitoring hours...' },
                { name: 'risk_notes', label: 'Risk Notes', max: 300, placeholder: 'Any known risks or special considerations for guards...' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">{field.label}</label>
                  <textarea
                    name={field.name}
                    value={(form as any)[field.name]}
                    onChange={handleChange}
                    rows={2}
                    maxLength={field.max}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 resize-none placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-1 text-right">{((form as any)[field.name] || '').length}/{field.max}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-[#1e2d4d]">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Saving...</>
            ) : (
              <><i className="ri-save-line"></i>{site ? 'Update Site' : 'Save Site'}</>
            )}
          </button>
          <button onClick={onClose}
            className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}