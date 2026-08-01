'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Recipient {
  id: string;
  name: string;
  email: string;
}

interface BulkEmailModalProps {
  recipients: Recipient[];
  accountType: 'clients' | 'guards';
  onClose: () => void;
  onSuccess: () => void;
}

const quickTemplates = [
  {
    name: 'Account Update',
    subject: 'Important Account Update - QuickGuard',
    body: 'We wanted to inform you about an important update to your QuickGuard account. Please log in to your dashboard to review the changes.',
  },
  {
    name: 'Verification Reminder',
    subject: 'Action Required: Complete Your Verification',
    body: 'This is a friendly reminder to complete your account verification. Verified accounts get access to more features and opportunities on QuickGuard.',
  },
  {
    name: 'New Feature Announcement',
    subject: 'Exciting New Features on QuickGuard!',
    body: 'We are thrilled to announce new features that will enhance your experience on QuickGuard. Log in to explore what\'s new!',
  },
  {
    name: 'Policy Update',
    subject: 'Updated Terms & Policies - QuickGuard',
    body: 'We have updated our terms and policies. Please review the changes at your earliest convenience to continue using QuickGuard services.',
  },
  {
    name: 'Custom Message',
    subject: '',
    body: '',
  },
];

export default function BulkEmailModal({ recipients, accountType, onClose, onSuccess }: BulkEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removedRecipients, setRemovedRecipients] = useState<string[]>([]);

  const activeRecipients = recipients.filter(r => !removedRecipients.includes(r.id));

  const handleSelectTemplate = (template: typeof quickTemplates[0]) => {
    setSelectedTemplate(template.name);
    setSubject(template.subject);
    setMessage(template.body);
  };

  const handleRemoveRecipient = (id: string) => {
    setRemovedRecipients([...removedRecipients, id]);
  };

  const handleRestoreRecipient = (id: string) => {
    setRemovedRecipients(removedRecipients.filter(rid => rid !== id));
  };

  const generateEmailHtml = (recipientName: string, messageText: string) => {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:40px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">QuickGuard</h1>
</td></tr>
<tr><td style="padding:40px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${recipientName},</p>
${messageText.split('\n').map(line => `<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">${line}</p>`).join('')}
<p style="color:#374151;font-size:16px;line-height:1.6;margin:20px 0 0;">Best regards,<br><strong>The QuickGuard Team</strong></p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 40px;text-align:center;">
<p style="color:#6b7280;font-size:14px;margin:0;">&copy; 2024 QuickGuard. All rights reserved.</p>
<p style="color:#9ca3af;font-size:12px;margin:10px 0 0;">London, United Kingdom</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || activeRecipients.length === 0) return;

    setSending(true);
    setError('');
    setProgress(0);

    try {
      const batchSize = 10;
      const totalBatches = Math.ceil(activeRecipients.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const batch = activeRecipients.slice(i * batchSize, (i + 1) * batchSize);

        const emailRows = batch.map(recipient => ({
          email_type: 'bulk_admin_email',
          recipient_email: recipient.email,
          subject: subject,
          body_html: generateEmailHtml(recipient.name, message),
          status: 'pending',
          metadata: {
            account_type: accountType,
            sent_by: 'admin',
            bulk_send: true,
            recipient_name: recipient.name,
          },
        }));

        const { error: insertError } = await supabase
          .from('email_queue')
          .insert(emailRows);

        if (insertError) throw insertError;

        setProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      setSent(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending bulk emails:', err);
      setError(err.message || 'Failed to queue emails. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
        <div className="bg-[#0a1628] rounded-2xl max-w-md w-full p-8 text-center border border-[#1a2b4a] shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 flex items-center justify-center bg-emerald-500/10 rounded-full mx-auto mb-4 ring-1 ring-emerald-500/20">
            <div className="w-8 h-8 flex items-center justify-center">
              <i className="ri-check-line text-3xl text-emerald-400"></i>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Emails Queued Successfully!</h3>
          <p className="text-slate-400 mb-6">
            {activeRecipients.length} email{activeRecipients.length !== 1 ? 's' : ''} have been added to the queue and will be sent shortly.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium whitespace-nowrap cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-[#0a1628] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#1a2b4a] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1a2b4a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-500/10 rounded-xl ring-1 ring-teal-500/20">
                <i className="ri-mail-send-line text-xl text-teal-400"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Send Bulk Email</h3>
                <p className="text-sm text-slate-400">
                  Compose a message for {activeRecipients.length} selected {accountType}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#1a2b4a] transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-close-line text-xl text-slate-400"></i></div>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                Recipients ({activeRecipients.length})
              </label>
              <button
                onClick={() => setShowRecipients(!showRecipients)}
                className="text-sm text-teal-400 hover:text-teal-300 font-medium cursor-pointer flex items-center gap-1"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {showRecipients ? <i className="ri-arrow-up-s-line"></i> : <i className="ri-arrow-down-s-line"></i>}
                </div>
                {showRecipients ? 'Hide' : 'Show'} recipients
              </button>
            </div>

            {!showRecipients && (
              <div className="flex flex-wrap gap-2">
                {activeRecipients.slice(0, 5).map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 text-teal-300 rounded-full text-sm ring-1 ring-teal-500/20">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-user-line text-xs"></i></div>
                    {r.name}
                  </span>
                ))}
                {activeRecipients.length > 5 && (
                  <span className="inline-flex items-center px-3 py-1.5 bg-[#1a2b4a] text-slate-400 rounded-full text-sm">
                    +{activeRecipients.length - 5} more
                  </span>
                )}
              </div>
            )}

            {showRecipients && (
              <div className="border border-[#1a2b4a] rounded-xl max-h-48 overflow-y-auto">
                {recipients.map(r => {
                  const isRemoved = removedRecipients.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between px-4 py-2.5 border-b border-[#1a2b4a] last:border-0 ${isRemoved ? 'bg-[#0a1628] opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full text-white text-xs font-semibold flex-shrink-0 ${
                          accountType === 'clients' ? 'bg-gradient-to-br from-teal-500 to-sky-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        }`}>
                          {r.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isRemoved ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{r.name}</p>
                          <p className={`text-xs ${isRemoved ? 'text-slate-500' : 'text-slate-400'}`}>{r.email}</p>
                        </div>
                      </div>
                      {isRemoved ? (
                        <button
                          onClick={() => handleRestoreRecipient(r.id)}
                          className="text-xs text-teal-400 hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRemoveRecipient(r.id)}
                          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                        >
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {quickTemplates.map(t => (
                <button
                  key={t.name}
                  onClick={() => handleSelectTemplate(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    selectedTemplate === t.name
                      ? 'bg-teal-600 text-white'
                      : 'bg-[#1a2b4a] text-slate-300 hover:bg-[#243553]'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setSelectedTemplate(null); }}
              placeholder="Enter email subject..."
              className="w-full px-4 py-2.5 border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-[#111d35] text-slate-200 placeholder:text-slate-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Message <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs ${message.length > 2000 ? 'text-red-400' : 'text-slate-500'}`}>
                {message.length}/2000
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= 2000) {
                  setMessage(e.target.value);
                  setSelectedTemplate(null);
                }
              }}
              placeholder="Write your message here. Each recipient will be greeted by name automatically..."
              rows={8}
              className="w-full px-4 py-3 border border-[#1a2b4a] rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none bg-[#111d35] text-slate-200 placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-information-line"></i></div>
              Each email will be personalised with the recipient's name automatically.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl ring-1 ring-red-500/20">
              <div className="w-5 h-5 flex items-center justify-center"><i className="ri-error-warning-fill text-red-400 text-lg"></i></div>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#1a2b4a] bg-[#0a1628]/80">
          {sending && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">Sending emails...</span>
                <span className="text-sm text-slate-400">{progress}%</span>
              </div>
              <div className="w-full bg-[#1a2b4a] rounded-full h-2">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              <div className="w-4 h-4 inline-flex items-center justify-center mr-1"><i className="ri-mail-line"></i></div>
              {activeRecipients.length} recipient{activeRecipients.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={sending}
                className="px-5 py-2.5 border border-[#1a2b4a] text-slate-300 rounded-xl hover:bg-[#1a2b4a] transition-colors font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim() || activeRecipients.length === 0}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-send-plane-fill"></i></div>
                    Send to {activeRecipients.length} {accountType}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
