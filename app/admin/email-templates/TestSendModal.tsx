'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const TEST_RECIPIENT = 'admin@quickguard.uk';

interface TestSendModalProps {
  templateSlug: string;
  variables: string[];
  subject: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TestSendModal({
  templateSlug,
  variables,
  subject,
  isOpen,
  onClose,
}: TestSendModalProps) {
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; preview?: { subject: string; body_html: string } } | null>(null);
  const [step, setStep] = useState<'fill' | 'preview' | 'sent'>('fill');

  const updateVar = (key: string, value: string) => {
    setVarValues(prev => ({ ...prev, [key]: value }));
  };

  const handlePreviewAndSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('render-email-template', {
        body: {
          template_slug: templateSlug,
          to: TEST_RECIPIENT,
          variables: varValues,
          dry_run: true,
          is_test: true,
        },
      });

      if (error) {
        setResult({ success: false, message: error.message || 'Failed to render template' });
        setSending(false);
        return;
      }

      setResult({ success: true, message: 'Template rendered successfully', preview: data });
      setStep('preview');
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Unexpected error' });
    }

    setSending(false);
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('render-email-template', {
        body: {
          template_slug: templateSlug,
          to: TEST_RECIPIENT,
          variables: varValues,
          is_test: true,
        },
      });

      if (error) {
        setResult({ success: false, message: error.message || 'Failed to send email' });
      } else {
        setResult({ success: true, message: `Test email sent to ${TEST_RECIPIENT}! Email ID: ${data?.email_id || 'N/A'}` });
        setStep('sent');
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Unexpected error' });
    }

    setSending(false);
  };

  const handleReset = () => {
    setStep('fill');
    setResult(null);
    setVarValues({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-[#1e2d4a]">
        <div className="p-4 border-b border-[#1e2d4a] flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-white">
            {step === 'sent' ? 'Email Sent!' : step === 'preview' ? 'Confirm & Send' : 'Test Send'}
          </h3>
          <button
            onClick={() => { onClose(); handleReset(); }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
          >
            <i className="ri-close-line text-2xl text-slate-400"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'fill' && (
            <>
              <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3 flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ri-information-line text-teal-400"></i>
                </div>
                <p className="text-sm text-teal-300">
                  Test emails are sent to <span className="font-semibold">{TEST_RECIPIENT}</span>
                </p>
              </div>

              {variables.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Variable Values
                  </label>
                  <div className="space-y-3">
                    {variables.map(v => (
                      <div key={v}>
                        <label className="block text-xs text-slate-500 mb-1 font-mono">
                          {`{{${v}}}`}
                        </label>
                        <input
                          type="text"
                          value={varValues[v] || ''}
                          onChange={(e) => updateVar(v, e.target.value)}
                          className="w-full px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
                          placeholder={v}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {variables.length === 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-sm text-amber-300">
                    This template has no variables defined. You can still send a test with just the raw template.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 'preview' && result?.preview && (
            <>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-sm text-emerald-300 flex items-center gap-2">
                  <i className="ri-check-line"></i>
                  Template rendered with your data. Review below before sending.
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Subject</p>
                <p className="text-sm text-slate-200 bg-[#0a1628] rounded-lg p-3">{result.preview.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Body Preview</p>
                <div className="border border-[#1e2d4a] rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={result.preview.body_html || ''}
                    className="w-full bg-white"
                    style={{ minHeight: '300px' }}
                    title="Test Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </>
          )}

          {step === 'sent' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 flex items-center justify-center bg-emerald-500/15 rounded-full mx-auto mb-4">
                <i className="ri-check-line text-3xl text-emerald-400"></i>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Test Email Sent!</h4>
              <p className="text-slate-400 text-sm">{result?.message}</p>
              <p className="text-slate-500 text-xs mt-2">Check {TEST_RECIPIENT} inbox</p>
            </div>
          )}

          {result && !result.success && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-300 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {result.message}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#1e2d4a] flex gap-3 shrink-0">
          {step === 'fill' && (
            <>
              <button
                onClick={() => { onClose(); handleReset(); }}
                className="flex-1 px-4 py-2.5 border border-[#1e2d4a] text-slate-300 rounded-lg hover:bg-white/5 transition-colors font-medium whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handlePreviewAndSend}
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-medium whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Rendering...
                  </>
                ) : (
                  <>
                    <i className="ri-eye-line"></i>
                    Preview & Send
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('fill')}
                className="px-4 py-2.5 border border-[#1e2d4a] text-slate-300 rounded-lg hover:bg-white/5 transition-colors font-medium whitespace-nowrap"
              >
                Back
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-medium whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line"></i>
                    Send Test Email
                  </>
                )}
              </button>
            </>
          )}

          {step === 'sent' && (
            <>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2.5 border border-[#1e2d4a] text-slate-300 rounded-lg hover:bg-white/5 transition-colors font-medium whitespace-nowrap"
              >
                Send Another
              </button>
              <button
                onClick={() => { onClose(); handleReset(); }}
                className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-medium whitespace-nowrap"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}