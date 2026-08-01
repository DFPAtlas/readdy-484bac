'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  requestId: string;
  guardName: string;
  jobTitle: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CompletionReviewModal({ requestId, guardName, jobTitle, onSuccess, onClose }: Props) {
  const [action, setAction] = useState<'approve' | 'dispute' | null>(null);
  const [rating, setRating] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const review = action === 'approve' ? {
        rating,
        punctuality_rating: punctuality,
        professionalism_rating: professionalism,
        communication_rating: communication,
        comment,
      } : undefined;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approve-job-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            requestId,
            action,
            disputeReason: action === 'dispute' ? disputeReason : undefined,
            review,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div className="mb-4">
      <p className="text-sm text-slate-300 mb-2">{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              n <= value ? 'text-amber-400' : 'text-slate-600'
            }`}
          >
            <i className="ri-star-fill text-lg"></i>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111d35] rounded-2xl max-w-lg w-full border border-[#1e2d4d] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#1e2d4d]">
          <h2 className="text-xl font-bold text-white">Review Job Completion</h2>
          <p className="text-sm text-slate-400 mt-1">
            {guardName} completed <span className="text-teal-400">{jobTitle}</span>
          </p>
        </div>

        <div className="p-6">
          {!action ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-300 mb-3">How would you like to proceed?</p>
              <button
                onClick={() => setAction('approve')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                  <i className="ri-check-double-line text-emerald-400 text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Approve & Release Payment</p>
                  <p className="text-xs text-slate-500">Confirm the job was done well and release payment to the guard</p>
                </div>
              </button>
              <button
                onClick={() => setAction('dispute')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors text-left cursor-pointer"
              >
                <div className="w-10 h-10 bg-orange-500/15 rounded-lg flex items-center justify-center">
                  <i className="ri-alert-line text-orange-400 text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-400">Raise a Dispute</p>
                  <p className="text-xs text-slate-500">Flag an issue — admin will review before releasing payment</p>
                </div>
              </button>
            </div>
          ) : action === 'approve' ? (
            <div>
              <p className="text-sm text-slate-300 mb-4">Leave optional feedback for {guardName}:</p>
              <StarRating value={rating} onChange={setRating} label="Overall Rating" />
              <StarRating value={punctuality} onChange={setPunctuality} label="Punctuality" />
              <StarRating value={professionalism} onChange={setProfessionalism} label="Professionalism" />
              <StarRating value={communication} onChange={setCommunication} label="Communication" />
              <div className="mb-4">
                <p className="text-sm text-slate-300 mb-2">Comment (optional)</p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500 resize-none"
                  placeholder="How did the guard perform?"
                />
                <p className="text-xs text-slate-500 mt-1">{comment.length}/500</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-300 mb-4">Tell us what went wrong:</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                maxLength={500}
                rows={4}
                required
                className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm focus:ring-2 focus:ring-orange-500 placeholder:text-slate-500 resize-none"
                placeholder="Describe the issue..."
              />
              <p className="text-xs text-slate-500 mt-1">{disputeReason.length}/500</p>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#1e2d4d] flex items-center gap-3">
          {action && (
            <button
              onClick={() => {
                setAction(null);
                setError(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Back
            </button>
          )}
          <div className="flex-1"></div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          {action && (
            <button
              onClick={handleSubmit}
              disabled={loading || (action === 'dispute' && !disputeReason.trim())}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                action === 'approve'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : action === 'approve' ? (
                <span className="flex items-center gap-2">
                  <i className="ri-check-line"></i>Approve & Release
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <i className="ri-alert-line"></i>Submit Dispute
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}