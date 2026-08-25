'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientJob } from '@/lib/client-types';

interface QuickDuplicateModalProps {
  job: ClientJob;
  clientId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickDuplicateModal({ job, clientId, onClose, onSuccess }: QuickDuplicateModalProps) {
  const [form, setForm] = useState({
    job_title: `Copy of ${job.job_title || 'Job'}`,
    start_date: '',
    end_date: '',
    start_time: job.start_time?.slice(0, 5) || '',
    end_time: job.end_time?.slice(0, 5) || '',
    number_of_guards: String(job.number_of_guards || 1),
    hourly_rate: String(job.hourly_rate || ''),
    venue_name: job.venue_name || '',
    venue_city: job.venue_city || '',
    venue_postcode: job.venue_postcode || '',
    venue_address_line1: job.venue_address_line1 || '',
    job_description: job.job_description || '',
    security_type: job.security_type || '',
    special_instructions: job.special_instructions || '',
  });
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handlePost = async () => {
    setError('');
    if (!form.job_title.trim()) { setError('Job title is required'); return; }
    if (!form.start_date) { setError('Start date is required'); return; }
    if (!form.start_time) { setError('Start time is required'); return; }
    if (!form.end_time) { setError('End time is required'); return; }
    const numGuards = parseInt(form.number_of_guards);
    if (isNaN(numGuards) || numGuards < 1) { setError('At least 1 guard is required'); return; }
    const rate = parseFloat(form.hourly_rate);
    if (isNaN(rate) || rate < 10) { setError('Hourly rate must be at least £10'); return; }

    setPosting(true);
    try {
      const formatTime = (time: string) => {
        if (!time) return null;
        const trimmed = time.trim();
        return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
      };

      const cid = clientId;
      if (!cid) { setError('Client not found'); return; }

      const { data: jobData, error: insertError } = await supabase
        .from('jobs')
        .insert({
          client_id: cid,
          job_title: form.job_title.trim(),
          security_type: form.security_type,
          job_description: form.job_description.trim() || null,
          venue_name: form.venue_name.trim(),
          venue_address_line1: form.venue_address_line1.trim(),
          venue_city: form.venue_city.trim(),
          venue_postcode: form.venue_postcode.trim(),
          number_of_guards: numGuards,
          start_date: form.start_date,
          end_date: form.end_date || form.start_date,
          start_time: formatTime(form.start_time),
          end_time: formatTime(form.end_time),
          hourly_rate: rate,
          special_instructions: form.special_instructions.trim() || null,
          status: 'open',
        })
        .select()
        .maybeSingle();

      if (insertError) throw insertError;
      if (!jobData) throw new Error('Job was not created');

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && jobData.id) {
        try {
          const efResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-matching-guards`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ jobId: jobData.id }),
          });
          if (!efResponse.ok) {
            console.warn('Edge function notify-matching-guards returned:', efResponse.status);
          }
        } catch {
          console.warn('Edge function notify-matching-guards unreachable');
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate job. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#1e2d4d]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Duplicate Job</h2>
            <p className="text-sm text-slate-500 mt-0.5">Copy and modify the details</p>
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
            <label className="block text-sm font-semibold text-slate-300 mb-2">Venue</label>
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

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 1</label>
            <input name="venue_address_line1" value={form.venue_address_line1} onChange={handleChange} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#162036] text-white" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Site Instructions</label>
            <textarea name="special_instructions" value={form.special_instructions} onChange={handleChange} rows={3} maxLength={500} className="w-full px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#162036] text-white" placeholder="Any special instructions..." />
            <p className="text-xs text-slate-500 mt-1 text-right">{form.special_instructions.length}/500</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handlePost}
              disabled={posting}
              className="flex-1 bg-teal-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-2"
            >
              {posting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Posting…
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line"></i>
                  Post Duplicated Job
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={posting}
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