'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { canSendJobMessage } from '@/lib/message-permissions';

interface MessageClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  clientUserId: string;
  clientName: string;
  jobTitle: string;
  guardUserId: string;
}

export default function MessageClientModal({
  isOpen,
  onClose,
  jobId,
  clientUserId,
  clientName,
  jobTitle,
  guardUserId,
}: MessageClientModalProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(true);
  const [existingCount, setExistingCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setMessage('');
    setChecking(true);
    setExistingCount(0);
    setSending(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
      return;
    }
    setChecking(true);
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .or(`sender_id.eq.${guardUserId},receiver_id.eq.${guardUserId}`)
      .then(({ count }) => {
        setExistingCount(count || 0);
        setChecking(false);
      });
  }, [isOpen, jobId, guardUserId, reset]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    if (text.length > 1000) {
      setError('Message must be 1000 characters or less.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const perm = await canSendJobMessage({
        currentUserId: guardUserId,
        currentUserType: 'guard',
        jobId: jobId,
        otherUserId: clientUserId,
        otherUserType: 'client',
      });
      if (!perm.allowed) {
        setError(perm.error || 'You do not have permission to message this client for this job.');
        setSending(false);
        return;
      }
      const { error: insertError } = await supabase.from('messages').insert({
        sender_id: guardUserId,
        sender_type: 'guard',
        receiver_id: clientUserId,
        receiver_type: 'client',
        message_text: text,
        job_id: jobId,
        read: false,
      });
      if (insertError) throw insertError;
      try {
        await supabase.from('notifications').insert({
          user_id: clientUserId,
          user_type: 'client',
          type: 'message',
          title: 'New message',
          message: `New message from guard${jobTitle ? ` for "${jobTitle}"` : ''}`,
          link: '/client/messages',
          is_read: false,
        });
      } catch (notifyErr) {
        console.error('Failed to create notification:', notifyErr);
      }
      onClose();
      router.push('/guard/messages');
    } catch (e: any) {
      setError(e.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-1">Message Client</h3>
        <p className="text-sm text-slate-400 mb-4">
          {jobTitle} <span className="text-slate-600">·</span> {clientName}
        </p>

        {checking ? (
          <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Checking conversation...
          </div>
        ) : existingCount > 0 ? (
          <div className="py-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <i className="ri-checkbox-circle-line text-emerald-400 mt-0.5"></i>
                <div>
                  <p className="text-sm font-medium text-emerald-400">Conversation already exists</p>
                  <p className="text-xs text-slate-400 mt-1">
                    You already have a message thread with this client for this job.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { onClose(); router.push('/guard/messages'); }}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-message-3-line mr-1.5"></i>
                Open Messages
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-[#162036] hover:bg-[#1a2642] text-slate-300 py-3 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message to the client..."
              maxLength={1000}
              rows={4}
              className="w-full bg-[#0e1628] border border-[#1e2d4d] rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none"
            />
            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="text-xs text-slate-500">{message.length}/1000</span>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <>
                    <i className="ri-send-plane-fill mr-1.5"></i>
                    Send Message
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                disabled={sending}
                className="flex-1 bg-[#162036] hover:bg-[#1a2642] text-slate-300 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}