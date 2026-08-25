'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientJob } from '@/lib/client-types';

interface EditJobModalProps {
  job: ClientJob;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditJobModal({ job, onClose, onSuccess }: EditJobModalProps) {
  const [form, setForm] = useState({
    job_title: job.job_title || '',
    venue_name: job.venue_name || '',
    venue_city: job.venue_city || '',
    venue_postcode: job.venue_postcode || '',
    start_date: job.start_date || '',
    end_date: job.end_date || '',
    start_time: job.start_time?.slice(0, 5) || '',
    end_time: job.end_time?.slice(0, 5) || '',
    number_of_guards: String(job.number_of_guards || 1),
    hourly_rate: String(job.hourly_rate || ''),
    special_instructions: job.special_instructions || '',
    is_featured: !!job.is_featured,
    is_urgent: !!job.is_urgent,
    expires_at: job.expires_at ? new Date(job.expires_at).toISOString().slice(0, 16) : '',
    publish_at: job.publish_at ? new Date(job.publish_at).toISOString().slice(0, 16) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSave = async () => {
    setError('');
    if (!form.job_title.trim()) { setError('Job title is required'); return; }
    if (!form.venue_name.trim()) { setError('Venue name is required'); return; }
    if (!form.start_date) { setError('Start date is required'); return; }
    if (!form.start_time) { setError('Start time is required'); return; }
    if (!form.end_time) { setError('End time is required'); return; }
    const numGuards = parseInt(form.number_of_guards);
    if (isNaN(numGuards) || numGuards < 1) { setError('At least 1 guard is required'); return; }
    const rate = parseFloat(form.hourly_rate);
    if (isNaN(rate) || rate < 10) { setError('Hourly rate must be at least £10'); return; }

    setSaving(true);
    try {
      const formatTime = (time: string) => {
        if (!time) return null;
        const trimmed = time.trim();
        return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
      };

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          job_title: form.job_title.trim(),
          venue_name: form.venue_name.trim(),
          venue_city: form.venue_city.trim(),
          venue_postcode: form.venue_postcode.trim(),
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          start_time: formatTime(form.start_time),
          end_time: formatTime(form.end_time),
          number_of_guards: numGuards,
          hourly_rate: rate,
          special_instructions: form.special_instructions.trim() || null,
          is_featured: form.is_featured,
          is_urgent: form.is_urgent,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (updateError) throw updateError;
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#1e2d4d]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Job</h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">{job.job_title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 flex items-center gap-2">
              <i className="ri-error-warning-line text-red-400"></i>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Job Title</label>
            <input name="job_title" value={form.job_title} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Venue Name</label>
            <input name="venue_name" value={form.venue_name} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">City</label>
              <input name="venue_city" value={form.venue_city} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Postcode</label>
              <input name="venue_postcode" value={form.venue_postcode} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Start Date</label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">End Date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Start Time</label>
              <input type="time" name="start_time" value={form.start_time} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">End Time</label>
              <input type="time" name="end_time" value={form.end_time} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Guards Needed</label>
              <input type="number" name="number_of_guards" min={1} value={form.number_of_guards} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Hourly Rate (£)</label>
              <input type="number" name="hourly_rate" min={10} step={0.01} value={form.hourly_rate} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Site Instructions</label>
            <textarea name="special_instructions" value={form.special_instructions} onChange={handleChange} rows={3} maxLength={500} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white" placeholder="Any special instructions for the guards..." />
            <p className="text-xs text-slate-500 mt-1 text-right">{form.special_instructions.length}/500</p>
          </div>

          <div className="border-t border-[#1e2d4d] pt-4">
            <label className="block text-sm font-semibold text-white mb-3">Boost & Scheduling</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, is_featured: !prev.is_featured }))}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${form.is_featured ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e2d4d] bg-[#162036] hover:border-[#2a3d5f]'}`}
              >
                <i className={`ri-vip-crown-line ${form.is_featured ? 'text-violet-400' : 'text-slate-500'}`}></i>
                <span className={`text-xs font-semibold ${form.is_featured ? 'text-white' : 'text-slate-400'}`}>Featured</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, is_urgent: !prev.is_urgent }))}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${form.is_urgent ? 'border-red-500 bg-red-500/10' : 'border-[#1e2d4d] bg-[#162036] hover:border-[#2a3d5f]'}`}
              >
                <i className={`ri-flashlight-line ${form.is_urgent ? 'text-red-400' : 'text-slate-500'}`}></i>
                <span className={`text-xs font-semibold ${form.is_urgent ? 'text-white' : 'text-slate-400'}`}>Urgent</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Publish At</label>
                <input type="datetime-local" value={form.publish_at} onChange={e => setForm(prev => ({ ...prev, publish_at: e.target.value }))} className="w-full px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-xs focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Expires At</label>
                <input type="datetime-local" value={form.expires_at} onChange={e => setForm(prev => ({ ...prev, expires_at: e.target.value }))} className="w-full px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-xs focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving…
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 border border-[#1e2d4d] text-slate-400 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}