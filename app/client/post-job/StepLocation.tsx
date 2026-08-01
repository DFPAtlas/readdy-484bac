'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
}

interface FormData {
  venue: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  siteContactName: string;
  siteContactPhone: string;
  siteInstructions: string;
  uniformDetails: string;
  dressCode: string;
  specialInstructions: string;
  savedSiteId: string;
}

interface StepLocationProps {
  formData: FormData;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onNext: () => void;
  onBack: () => void;
  clientId: string;
  savedSites: SavedSite[];
  loadingSites: boolean;
  onSiteSaved: () => void;
}

function getSiteCompleteness(site: SavedSite): number {
  let score = 0;
  if (site.address_line1 && site.city && site.postcode) score++;
  if (site.site_contact_name && site.site_contact_phone) score++;
  if (site.emergency_contact_name && site.emergency_contact_phone) score++;
  if (site.access_instructions) score++;
  if (site.parking_details) score++;
  if (site.risk_notes) score++;
  return score;
}

export default function StepLocation({ formData, errors, onChange, onNext, onBack, clientId, savedSites, loadingSites, onSiteSaved }: StepLocationProps) {
  const [showSaveSite, setShowSaveSite] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [siteSaveToast, setSiteSaveToast] = useState('');

  useEffect(() => {
    if (siteSaveToast) {
      const t = setTimeout(() => setSiteSaveToast(''), 3000);
      return () => clearTimeout(t);
    }
  }, [siteSaveToast]);

  const applySite = (site: SavedSite) => {
    const synthetic = (name: string, value: string) => {
      const e = { target: { name, value } } as React.ChangeEvent<HTMLInputElement>;
      onChange(e);
    };
    synthetic('savedSiteId', site.id);
    synthetic('venue', site.site_name);
    synthetic('addressLine1', site.address_line1);
    synthetic('addressLine2', site.address_line2 || '');
    synthetic('city', site.city);
    synthetic('postcode', site.postcode);
    synthetic('siteContactName', site.site_contact_name || '');
    synthetic('siteContactPhone', site.site_contact_phone || '');
    synthetic('siteInstructions', [
      site.access_instructions,
      site.parking_details,
      site.risk_notes,
      site.key_entry_instructions,
      site.patrol_expectations,
      site.cctv_details,
    ].filter(Boolean).join('\n\n'));
    synthetic('uniformDetails', site.uniform_requirements || '');
    synthetic('dressCode', site.uniform_requirements || '');
    synthetic('specialInstructions', [
      site.patrol_expectations,
      site.cctv_details,
    ].filter(Boolean).join('\n\n'));
  };

  const handleSaveAsSite = async () => {
    if (!clientId) return;
    setSavingSite(true);
    try {
      const { error } = await supabase.from('saved_sites').insert({
        client_id: clientId,
        site_name: formData.venue || 'Untitled Site',
        address_line1: formData.addressLine1,
        address_line2: formData.addressLine2 || null,
        city: formData.city,
        postcode: formData.postcode,
        site_contact_name: formData.siteContactName || null,
        site_contact_phone: formData.siteContactPhone || null,
        access_instructions: formData.siteInstructions || null,
        status: 'active',
        archived: false,
      });
      if (error) throw error;
      setSiteSaveToast('Site saved for future use');
      setShowSaveSite(false);
    } catch {
      setSiteSaveToast('Failed to save site');
    } finally {
      setSavingSite(false);
      onSiteSaved();
    }
  };

  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm">
      {siteSaveToast && (
        <div className="mb-4 bg-[#162036] border border-teal-500/20 rounded-xl p-3 flex items-center gap-2 text-sm text-teal-400">
          <i className="ri-checkbox-circle-fill"></i>
          {siteSaveToast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-500 text-white rounded-xl flex items-center justify-center font-bold">2</div>
        <div>
          <h2 className="text-xl font-bold text-white">Location & Site Details</h2>
          <p className="text-sm text-slate-500">Where the security work will take place</p>
        </div>
      </div>

      {/* Saved Sites Section */}
      {savedSites.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-300">Choose Saved Site</label>
            <Link href="/client/sites" className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer whitespace-nowrap">
              <i className="ri-add-line mr-0.5"></i>Manage Sites
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedSites.map(site => {
              const completeness = getSiteCompleteness(site);
              const isSelected = formData.savedSiteId === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => applySite(site)}
                  className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500/10'
                      : 'border-[#1e2d4d] hover:border-[#2a3d5f] bg-[#162036]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-teal-500/20' : 'bg-[#111d35]'}`}>
                    <i className={`ri-building-line ${isSelected ? 'text-teal-400' : 'text-slate-500'}`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>{site.site_name}</p>
                      {site.status === 'needs_info' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Needs Info</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{site.address_line1}, {site.city}</p>
                    {/* Completeness bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#111d35] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${completeness === 6 ? 'bg-emerald-500' : completeness >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(completeness / 6) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs ${completeness === 6 ? 'text-emerald-400' : completeness >= 4 ? 'text-amber-400' : 'text-red-400'}`}>
                        {completeness}/6
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <i className="ri-checkbox-circle-fill text-teal-400 ml-auto flex-shrink-0 mt-1"></i>
                  )}
                </button>
              );
            })}
          </div>
          {formData.savedSiteId && (
            <button
              type="button"
              onClick={() => {
                const e = { target: { name: 'savedSiteId', value: '' } } as React.ChangeEvent<HTMLInputElement>;
                onChange(e);
              }}
              className="text-xs text-slate-500 hover:text-slate-300 mt-2 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-close-line mr-0.5"></i>Clear selection
            </button>
          )}
        </div>
      )}

      {loadingSites && savedSites.length === 0 && (
        <div className="flex items-center gap-2 text-slate-500 text-sm mb-6">
          <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
          Loading saved sites...
        </div>
      )}

      {savedSites.length === 0 && !loadingSites && (
        <div className="bg-[#162036] rounded-xl p-4 border border-[#1e2d4d] mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#111d35] rounded-lg flex items-center justify-center">
              <i className="ri-building-line text-slate-500"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-300">No saved sites yet</p>
              <p className="text-xs text-slate-500">Save sites to autofill location details</p>
            </div>
          </div>
          <Link href="/client/sites" className="text-xs bg-teal-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
            Add Site
          </Link>
        </div>
      )}

      {/* Manual Entry */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Enter Location Manually</h3>
          {formData.venue && formData.addressLine1 && formData.city && formData.postcode && (
            <button
              type="button"
              onClick={() => setShowSaveSite(true)}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold cursor-pointer whitespace-nowrap flex items-center gap-1"
            >
              <i className="ri-save-line"></i>
              Save as New Site
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Site Name *</label>
          <input
            type="text"
            name="venue"
            value={formData.venue}
            onChange={onChange}
            placeholder="e.g., The Grand Hotel, O2 Arena, Westfield Shopping Centre"
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
          {errors.venue && <p className="text-red-400 text-sm mt-1">{errors.venue}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Full Address Line 1 *</label>
          <input
            type="text"
            name="addressLine1"
            value={formData.addressLine1}
            onChange={onChange}
            placeholder="Street address"
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
          {errors.addressLine1 && <p className="text-red-400 text-sm mt-1">{errors.addressLine1}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 2 (optional)</label>
          <input
            type="text"
            name="addressLine2"
            value={formData.addressLine2}
            onChange={onChange}
            placeholder="Apartment, suite, building name, floor number..."
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">City *</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={onChange}
              placeholder="e.g., London"
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
            />
            {errors.city && <p className="text-red-400 text-sm mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Postcode *</label>
            <input
              type="text"
              name="postcode"
              value={formData.postcode}
              onChange={onChange}
              placeholder="e.g., SW1A 1AA"
              className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
            />
            {errors.postcode && <p className="text-red-400 text-sm mt-1">{errors.postcode}</p>}
          </div>
        </div>

        {formData.postcode && (
          <div className="rounded-2xl overflow-hidden border border-[#1e2d4d]">
            <iframe
              src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${encodeURIComponent([formData.addressLine1, formData.city, formData.postcode].filter(Boolean).join(', '))}`}
              width="100%"
              height="200"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
            ></iframe>
          </div>
        )}

        <div className="border-t border-[#1e2d4d] pt-6">
          <h3 className="text-sm font-semibold text-white mb-4">Site Contact (optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Site Contact Name</label>
              <input
                type="text"
                name="siteContactName"
                value={formData.siteContactName}
                onChange={onChange}
                placeholder="e.g., John Smith (Duty Manager)"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Site Contact Phone</label>
              <input
                type="tel"
                name="siteContactPhone"
                value={formData.siteContactPhone}
                onChange={onChange}
                placeholder="07XXX XXXXXX"
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            Site Instructions (optional)
          </label>
          <textarea
            name="siteInstructions"
            value={formData.siteInstructions}
            onChange={onChange}
            maxLength={500}
            rows={4}
            placeholder="Parking info, entrance details, security check-in, access codes, nearest tube station, key collection, patrol routes, CCTV info..."
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-white text-sm resize-none placeholder:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1 text-right">{formData.siteInstructions.length}/500</p>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button type="button" onClick={onBack} className="text-slate-400 hover:text-white font-semibold cursor-pointer whitespace-nowrap">
          <i className="ri-arrow-left-line mr-1"></i> Back
        </button>
        <button type="button" onClick={onNext} className="bg-teal-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
          Next: Shift Times <i className="ri-arrow-right-line ml-1"></i>
        </button>
      </div>

      {/* Save as Site confirmation modal */}
      {showSaveSite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111d35] rounded-2xl max-w-md w-full border border-[#1e2d4d] shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Save as New Site?</h3>
            <p className="text-sm text-slate-400 mb-6">
              Save <span className="text-white font-semibold">{formData.venue || 'this location'}</span> to your saved sites so you can reuse it for future jobs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSaveAsSite}
                disabled={savingSite}
                className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {savingSite ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>
                    Save Site
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSaveSite(false)}
                className="px-6 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}