'use client';

import { useState, useMemo } from 'react';

interface TemplatePreviewProps {
  bodyHtml: string;
  subject: string;
  variables: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function TemplatePreview({
  bodyHtml = '',
  subject = '',
  variables = [],
  isOpen,
  onClose,
}: TemplatePreviewProps) {
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const updateSample = (key: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [key]: value }));
  };

  const safeReplace = (text: string): string => {
    if (!text || typeof text !== 'string') return '';
    try {
      let result = text;
      for (const [key, value] of Object.entries(sampleData)) {
        result = result.split(`{{${key}}}`).join(value || `[${key}]`);
      }
      result = result.replace(/\{\{(\w+)\}\}/g, '[$1]');
      return result;
    } catch {
      return text;
    }
  };

  const previewSubject = useMemo(() => {
    try {
      return safeReplace(subject || '');
    } catch {
      return subject || '';
    }
  }, [subject, sampleData]);

  const resolvedBodyHtml = useMemo(() => {
    try {
      return safeReplace(bodyHtml || '');
    } catch {
      return bodyHtml || '';
    }
  }, [bodyHtml, sampleData]);

  const previewHtml = useMemo(() => {
    setPreviewError(null);
    try {
      const body = resolvedBodyHtml || '';
      if (/<html/i.test(body)) {
        return body;
      }
      return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; }
</style>
</head>
<body>${body}</body>
</html>`;
    } catch (err: any) {
      setPreviewError(err?.message || 'Unknown error while generating preview');
      return '';
    }
  }, [resolvedBodyHtml]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111d35] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-[#1e2d4a]">
        <div className="p-4 border-b border-[#1e2d4a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Preview</h3>
            <div className="flex bg-[#0a1628] rounded-lg p-0.5">
              <button
                onClick={() => setDeviceView('desktop')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  deviceView === 'desktop' ? 'bg-[#111d35] text-white shadow-sm' : 'text-slate-400'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center inline mr-1">
                  <i className="ri-computer-line"></i>
                </div>
                Desktop
              </button>
              <button
                onClick={() => setDeviceView('mobile')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  deviceView === 'mobile' ? 'bg-[#111d35] text-white shadow-sm' : 'text-slate-400'
                }`}
              >
                <div className="w-4 h-4 flex items-center justify-center inline mr-1">
                  <i className="ri-smartphone-line"></i>
                </div>
                Mobile
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-close-line text-xl text-slate-400"></i>
            </div>
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-[#1e2d4a] p-4 overflow-y-auto shrink-0">
            <h4 className="text-sm font-semibold text-white mb-3">Sample Data</h4>
            <p className="text-xs text-slate-400 mb-4">
              Fill in values to see how variables render in the preview.
              Empty values show as <code className="bg-[#0a1628] px-1 rounded text-slate-400">[var_name]</code>.
            </p>
            <div className="space-y-3">
              {variables.map((v) => (
                <div key={v}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {`{{${v}}}`}
                  </label>
                  <input
                    type="text"
                    value={sampleData[v] || ''}
                    onChange={(e) => updateSample(v, e.target.value)}
                    className="w-full px-3 py-2 border border-[#1e2d4a] rounded-lg text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
                    placeholder={`e.g., ${getPlaceholder(v)}`}
                  />
                </div>
              ))}
              {variables.length === 0 && (
                <p className="text-sm text-slate-500 italic">No variables defined for this template.</p>
              )}
            </div>
          </div>

          <div className="flex-1 bg-[#0a0f1c] p-6 overflow-auto flex items-start justify-center">
            <div
              className="bg-white rounded-lg shadow-lg overflow-hidden transition-all"
              style={{
                width: deviceView === 'mobile' ? '100%' : '100%',
                maxWidth: deviceView === 'mobile' ? '390px' : '100%',
              }}
            >
              <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <span className="text-xs text-slate-400 ml-2 truncate">
                  Subject: {(previewSubject || '(no subject)')}
                </span>
              </div>

              {previewError ? (
                <div className="p-8">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-5">
                    <div className="w-10 h-10 flex items-center justify-center bg-red-500/15 rounded-full mx-auto mb-3">
                      <i className="ri-error-warning-line text-xl text-red-400"></i>
                    </div>
                    <h4 className="text-sm font-semibold text-red-300 text-center mb-1">
                      Preview could not be generated
                    </h4>
                    <p className="text-xs text-red-400 text-center">
                      Please check the email HTML. {previewError}
                    </p>
                  </div>
                </div>
              ) : (
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  className="w-full border-0 bg-white"
                  style={{ minHeight: '600px' }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(variable: string): string {
  const defaults: Record<string, string> = {
    first_name: 'John',
    email: 'john@example.com',
    job_title: 'Security Guard - Night Shift',
    venue: 'The Grand Hotel',
    date: '15 June 2025',
    time: '10:00 PM - 6:00 AM',
    amount: '150.00',
    plan_name: 'Professional',
    pay_rate: '15.00',
    dashboard_url: 'https://quickguard.uk/dashboard',
    support_email: 'support@quickguard.uk',
    client_name: 'ABC Events Ltd',
    guard_name: 'Sarah Smith',
    location: 'London, UK',
    address: '123 Main Street, London',
    start_time: '10:00 PM',
  };
  return defaults[variable] || variable;
}