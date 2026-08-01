'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface TicketMessage {
  id: string;
  sender_id: string;
  sender_type: string;
  sender_name?: string;
  message_text: string;
  created_at: string;
  is_internal: boolean;
}

interface Ticket {
  id: string;
  ticket_reference: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  related_job_id?: string;
  job_title?: string;
  payment_amount?: number;
  requested_refund_amount?: number;
  refund_reason?: string;
  evidence_url?: string;
  contact_preference?: string;
  admin_notes?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface TicketDetailDrawerProps {
  ticket: Ticket;
  clientId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const categoryLabels: Record<string, string> = {
  general_support: 'General Support',
  payment_issue: 'Payment Issue',
  guard_no_show: 'Guard No-Show',
  late_arrival: 'Late Arrival',
  poor_performance: 'Poor Performance',
  refund_request: 'Refund Request',
  job_cancellation: 'Job Cancellation',
  technical_issue: 'Technical Issue',
  account_billing: 'Account/Billing Help',
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TicketDetailDrawer({ ticket, clientId, onClose, onUpdated }: TicketDetailDrawerProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ticketStatus, setTicketStatus] = useState(ticket.status);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`ticket-${ticket.id}-messages`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'ticket_messages', filter: `ticket_id=eq.${ticket.id}` }, () => {
        loadMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTicketStatus(ticket.status);
  }, [ticket.status]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setError('');
    setSending(true);
    try {
      const { error: msgError } = await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: clientId,
        sender_type: 'client',
        message_text: replyText.trim(),
        is_internal: false,
      });
      if (msgError) throw msgError;

      if (ticketStatus !== 'awaiting_client') {
        const { error: updateError } = await supabase
          .from('support_tickets')
          .update({ status: 'awaiting_client', updated_at: new Date().toISOString() })
          .eq('id', ticket.id);
        if (updateError) throw updateError;
      }

      setReplyText('');
      onUpdated();
      loadMessages();
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const canReply = ticketStatus !== 'resolved' && ticketStatus !== 'closed';
  const isRefund = ticket.category === 'refund_request';
  const isResolved = ticketStatus === 'resolved' || ticketStatus === 'closed';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-[#111d35] h-full overflow-y-auto border-l border-[#1e2d4d] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#111d35] border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-white truncate max-w-xs">{ticket.subject}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{ticket.ticket_reference}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#162036] transition-colors cursor-pointer">
            <i className="ri-close-line text-slate-500 text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Status & Priority */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={ticketStatus} />
              <PriorityBadge priority={ticket.priority} />
              {isResolved && (
                <span className="text-xs text-slate-500">
                  <i className="ri-calendar-check-line mr-0.5"></i>
                  {ticket.resolved_at ? `Resolved ${formatDate(ticket.resolved_at)}` : 'Resolved'}
                </span>
              )}
            </div>

            {/* Info Grid */}
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-file-info-line text-teal-400"></i>Ticket Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category</span>
                  <span className="text-slate-200 font-medium">{categoryLabels[ticket.category] || ticket.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created</span>
                  <span className="text-slate-200">{formatDateTime(ticket.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Updated</span>
                  <span className="text-slate-200">{formatDateTime(ticket.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact</span>
                  <span className="text-slate-200 capitalize">{ticket.contact_preference || 'Email'}</span>
                </div>
                {ticket.job_title && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Related Job</span>
                    <span className="text-teal-400 font-medium">{ticket.job_title}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Refund/Dispute Panel */}
            {isRefund && (
              <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4">
                <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <i className="ri-refund-line"></i>Refund Request
                </h3>
                <div className="space-y-2 text-sm">
                  {ticket.payment_amount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Amount</span>
                      <span className="text-slate-200 font-medium">£{ticket.payment_amount}</span>
                    </div>
                  )}
                  {ticket.requested_refund_amount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Requested Refund</span>
                      <span className="text-orange-400 font-bold">£{ticket.requested_refund_amount}</span>
                    </div>
                  )}
                  {ticket.refund_reason && (
                    <div className="pt-2 border-t border-orange-500/15">
                      <span className="text-slate-500">Reason:</span>
                      <p className="text-slate-300 mt-1">{ticket.refund_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-align-left text-teal-400"></i>Original Description
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{ticket.description}</p>
            </div>

            {/* Evidence */}
            {ticket.evidence_url && (
              <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <i className="ri-image-line text-teal-400"></i>Evidence
                </h3>
                <a
                  href={ticket.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-teal-400 text-sm font-medium hover:underline cursor-pointer"
                >
                  <i className="ri-external-link-line"></i>View Evidence
                </a>
              </div>
            )}

            {/* Resolution Notes */}
            {ticket.resolution_notes && (
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <i className="ri-checkbox-circle-line"></i>Resolution
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{ticket.resolution_notes}</p>
              </div>
            )}

            {/* Conversation */}
            <div className="bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <i className="ri-chat-3-line text-teal-400"></i>Conversation
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-6">
                  <div className="w-10 h-10 bg-[#111d35] rounded-xl flex items-center justify-center mx-auto mb-2">
                    <i className="ri-chat-off-line text-slate-600"></i>
                  </div>
                  <p className="text-sm text-slate-500">No replies yet. You will see admin responses here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isClient = msg.sender_type === 'client';
                    return (
                      <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isClient
                            ? 'bg-teal-500/10 border border-teal-500/20 text-teal-100'
                            : 'bg-[#111d35] border border-[#1e2d4d] text-slate-300'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold ${isClient ? 'text-teal-400' : 'text-violet-400'}`}>
                              {isClient ? 'You' : msg.sender_name || 'QuickGuard Support'}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              {formatDateTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{msg.message_text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {/* Reply Box */}
              {canReply && (
                <div className="mt-4 pt-4 border-t border-[#1e2d4d]">
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 mb-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="flex-1 px-4 py-3 border border-[#1e2d4d] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-[#111d35] text-white"
                      placeholder="Type your reply..."
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="self-end w-10 h-10 flex items-center justify-center bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <i className="ri-send-plane-fill"></i>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-right">{replyText.length}/500</p>
                </div>
              )}

              {!canReply && messages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#1e2d4d] text-center">
                  <p className="text-sm text-slate-500">
                    <i className="ri-lock-line mr-1"></i>
                    This ticket is {ticketStatus}. No further replies are possible.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}