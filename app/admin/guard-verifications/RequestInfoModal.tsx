'use client';

import { useState, useMemo } from 'react';
import { GuardVerification, getMissingProfileItems } from './types';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface RequestInfoModalProps {
  guard: GuardVerification | null;
  onClose: () => void;
  onSent: () => void;
}

export default function RequestInfoModal({ guard, onClose, onSent }: RequestInfoModalProps) {
  const admin = useAdminAuth();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const allMissing = useMemo(() => guard ? getMissingProfileItems(guard) : [], [guard]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set(allMissing));

  if (!guard) return null;

  const totalFields = 18;
  const completedFields = totalFields - allMissing.length;
  const completionPercent = Math.round((completedFields / totalFields) * 100);

  const profileItems = [
    { label: 'Full name', checked: !!guard.full_name?.trim() },
    { label: 'Phone number', checked: !!guard.phone?.trim() },
    { label: 'Date of birth', checked: !!guard.date_of_birth },
    { label: 'SIA licence number', checked: !!guard.sia_licence_number?.trim() },
    { label: 'Licence cardholder name', checked: !!guard.license_cardholder_name?.trim() },
    { label: 'SIA expiry date', checked: !!guard.sia_expiry_date },
    { label: 'Years of experience', checked: guard.years_experience != null && guard.years_experience !== 0 },
    { label: 'Hourly rate', checked: !!guard.hourly_rate },
    { label: 'Certifications', checked: !!guard.certifications && guard.certifications.length > 0 },
    { label: 'Available days', checked: !!guard.available_days && guard.available_days.length > 0 },
    { label: 'Working hours', checked: !!guard.available_hours_from && !!guard.available_hours_to },
    { label: 'Bio / About', checked: !!guard.bio?.trim() },
    { label: 'Profile photo', checked: !!guard.profile_image_url?.trim() },
    { label: 'SIA licence front image', checked: !!guard.sia_licence_front_url?.trim() },
    { label: 'SIA licence back image', checked: !!guard.sia_licence_back_url?.trim() },
    { label: 'Driving licence front', checked: !!guard.driving_licence_front_url?.trim() },
    { label: 'Driving licence back', checked: !!guard.driving_licence_back_url?.trim() },
    { label: 'Proof of address', checked: !!guard.proof_of_address_url?.trim() },
  ];

  const hasNoEmail = !guard.email?.trim();
  const itemsToSend = allMissing.filter(item => selectedItems.has(item));
  const nothingSelected = itemsToSend.length === 0;

  const toggleItem = (item: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedItems(new Set(allMissing));
  const deselectAll = () => setSelectedItems(new Set());

  const handleSend = async () => {
    if (hasNoEmail || nothingSelected) return;
    setSending(true);
    setError(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-profile-nudge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey!,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            guard_id: guard.id,
            guard_email: guard.email,
            guard_name: guard.full_name || 'Guard',
            completion_percent: completionPercent,
            missing_items: itemsToSend,
            admin_note: adminNote.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || `Server returned ${response.status}`);
      }

      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;

      await supabase.from('admin_activity_log').insert({
        admin_username: adminUsername,
        admin_name: adminName,
        action_type: 'guard_missing_info_email_sent',
        action_description: `Sent missing information email to ${guard.full_name || guard.email} (${itemsToSend.length} items)${adminNote.trim() ? ' with note' : ''}`,
        target_type: 'guard',
        entity_type: 'guard',
        entity_id: guard.id,
        target_name: guard.full_name || guard.email,
        details: {
          guard_id: guard.id,
          guard_email: guard.email,
          completion_percent: completionPercent,
          missing_items: itemsToSend,
          admin_note: adminNote.trim() || null,
        },
        metadata: {
          guard_id: guard.id,
          guard_email: guard.email,
          completion_percent: completionPercent,
          missing_items: itemsToSend,
          admin_note: adminNote.trim() || null,
        },
      });

      await supabase.from('notifications').insert({
        user_id: guard.user_id,
        user_type: 'guard',
        title: 'Missing information required',
        message: 'Please update your application or upload the missing documents so we can complete verification.',
        type: 'verification',
        link: '/guard/complete-profile-wizard?edit=1',
        data: {
          missing_items: itemsToSend,
          completion_percent: completionPercent,
          admin_note: adminNote.trim() || null,
        },
        is_read: false,
        read: false,
      });

      await supabase
        .from('guards')
        .update({ verification_status: 'incomplete', is_active: false, dashboard_access: false, updated_at: new Date().toISOString() })
        .eq('id', guard.id);

      onSent();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Send Missing Information Request</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select which missing fields to request from the guard
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
              {guard.profile_image_url ? (
                <img src={guard.profile_image_url} alt={guard.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-100 to-sky-100">
                  <i className="ri-user-line text-teal-600"></i>
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{guard.full_name || 'Unknown Guard'}</p>
              <p className="text-sm text-slate-500">{guard.email || 'No email address'}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Profile Completion</span>
              <span className={`text-sm font-bold ${completionPercent >= 80 ? 'text-emerald-600' : completionPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {completionPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completionPercent >= 80 ? 'bg-emerald-500' : completionPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">
                Missing Fields ({allMissing.length})
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                >
                  Select all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer whitespace-nowrap"
                >
                  Deselect all
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {profileItems.map((item) => {
                const isMissing = !item.checked;
                const isSelected = selectedItems.has(item.label);
                return (
                  <label
                    key={item.label}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      isMissing
                        ? 'hover:bg-red-50'
                        : 'opacity-50 cursor-default'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => isMissing && toggleItem(item.label)}
                      disabled={!isMissing}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 disabled:opacity-30 cursor-pointer"
                    />
                    <span className={`text-sm ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                      {item.label}
                    </span>
                    {item.checked && (
                      <span className="text-xs text-emerald-500 ml-auto">
                        <i className="ri-check-line"></i>
                      </span>
                    )}
                    {isMissing && isSelected && (
                      <span className="text-xs text-red-400 ml-auto">Will be requested</span>
                    )}
                  </label>
                );
              })}
            </div>
            {nothingSelected && allMissing.length > 0 && (
              <p className="text-xs text-amber-600 mt-2">Select at least one item to send the request</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Admin Note (optional)
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g., Please upload a clear photo of your SIA licence front and back. We need this before we can approve your account."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none bg-slate-50"
            ></textarea>
            <p className="text-xs text-slate-400 text-right mt-1">{adminNote.length}/500</p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-mail-send-line text-amber-600"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Email Preview</p>
              <p className="text-sm text-amber-700 mt-1">
                An email will be sent to <strong>{guard.email}</strong> listing{' '}
                <strong>{itemsToSend.length} missing field{itemsToSend.length !== 1 ? 's' : ''}</strong>
                {adminNote.trim() && ' with your personal note'}.
                The guard will be directed back to their application to upload missing documents.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-500 text-sm"></i>
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {hasNoEmail && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-500 text-sm"></i>
              </div>
              <p className="text-sm text-red-700">This guard has no email address. Cannot send information request.</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || hasNoEmail || nothingSelected}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin"></i>
                </div>
                Sending...
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-send-line"></i>
                </div>
                Send {itemsToSend.length > 0 ? `(${itemsToSend.length} items)` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}