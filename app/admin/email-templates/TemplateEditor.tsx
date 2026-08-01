'use client';

import { useRef, useState, useEffect } from 'react';

interface TemplateFormData {
  name: string;
  template_slug: string;
  subject: string;
  body_html: string;
  category: string;
  description: string;
  is_active: boolean;
}

interface TemplateEditorProps {
  formData: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
  isEditing: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onTestSend: () => void;
  onPreview: () => void;
  imageToInsert?: string | null;
  onImageInsertHandled?: () => void;
}

const commonVariables = [
  'first_name', 'email', 'job_title', 'venue', 'date', 'time',
  'amount', 'plan_name', 'pay_rate', 'dashboard_url', 'support_email',
  'client_name', 'guard_name', 'location', 'address', 'start_time',
];

const quickInserts = [
  {
    label: 'Logo',
    icon: 'ri-image-2-line',
    html: '<!-- QuickGuard Logo -->\n<img src="REPLACE_WITH_LOGO_URL" alt="QuickGuard" width="180" style="width:180px;max-width:180px;height:auto;display:block;border:0;" />',
  },
  {
    label: 'Banner',
    icon: 'ri-collage-line',
    html: '<!-- Header Banner -->\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#0D9488;">\n  <tr>\n    <td align="center" style="padding:40px 20px;">\n      <h1 style="color:#ffffff;font-family:Arial,sans-serif;font-size:28px;margin:0;">Banner Heading</h1>\n      <p style="color:#ccfbf1;font-family:Arial,sans-serif;font-size:16px;margin:12px 0 0;">Banner subheading text goes here</p>\n    </td>\n  </tr>\n</table>',
  },
  {
    label: 'Image',
    icon: 'ri-image-add-line',
    html: '<!-- Image Block -->\n<img src="REPLACE_WITH_IMAGE_URL" alt="QuickGuard image" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;margin:0 auto;" />',
  },
  {
    label: 'Divider',
    icon: 'ri-separator',
    html: '<!-- Divider -->\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">\n  <tr>\n    <td style="padding:20px 0;">\n      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">\n        <tr>\n          <td style="border-top:1px solid #334155;"></td>\n        </tr>\n      </table>\n    </td>\n  </tr>\n</table>',
  },
  {
    label: 'CTA',
    icon: 'ri-cursor-line',
    html: '<!-- CTA Button -->\n<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">\n  <tr>\n    <td align="center" style="padding:24px 0;">\n      <a href="REPLACE_WITH_LINK" style="display:inline-block;padding:14px 36px;background-color:#0D9488;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Click Here</a>\n    </td>\n  </tr>\n</table>',
  },
];

export default function TemplateEditor({
  formData,
  onChange,
  isEditing,
  saving,
  onSave,
  onCancel,
  onTestSend,
  onPreview,
  imageToInsert,
  onImageInsertHandled,
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [showVarMenu, setShowVarMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const update = (field: keyof TemplateFormData, value: string | boolean) => {
    onChange({ ...formData, [field]: value });
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const insertAtCursor = (html: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = formData.body_html.substring(0, start);
    const after = formData.body_html.substring(end);

    onChange({ ...formData, body_html: before + html + after });

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + html.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  useEffect(() => {
    if (imageToInsert) {
      insertAtCursor('\n' + imageToInsert + '\n');
      onImageInsertHandled?.();
    }
  }, [imageToInsert]);

  const insertVariable = (varName: string) => {
    insertAtCursor(`{{${varName}}}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertVariable('first_name');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onPreview}
              disabled={!formData.body_html}
              className="px-4 py-2 bg-purple-500/15 text-purple-400 rounded-lg hover:bg-purple-500/25 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
            >
              <i className="ri-eye-line"></i>
              Full Preview
            </button>
            <button
              onClick={onTestSend}
              disabled={!formData.body_html || !formData.subject}
              className="px-4 py-2 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
            >
              <i className="ri-send-plane-line"></i>
              Test Send
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Template Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                update('name', e.target.value);
                if (!isEditing) update('template_slug', generateSlug(e.target.value));
              }}
              className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
              placeholder="Welcome Email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Template Slug *
            </label>
            <input
              type="text"
              value={formData.template_slug}
              onChange={(e) => update('template_slug', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm font-mono bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
              placeholder="welcome-email"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email Subject *
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => update('subject', e.target.value)}
            className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
            placeholder="Welcome to QuickGuard, {{first_name}}!"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
            <div className="relative">
              <select
                value={formData.category}
                onChange={(e) => update('category', e.target.value)}
                className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm appearance-none pr-10 capitalize bg-[#0a1628] text-slate-200"
              >
                {['guard','client','admin','all'].map(a => (
                  <option key={a} value={a} className="capitalize">{a}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none">
                <i className="ri-arrow-down-s-line text-slate-400"></i>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
              placeholder="Brief description of when this template is used"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
              className="w-5 h-5 rounded border-[#1e2d4a] bg-[#0a1628] text-teal-600 focus:ring-teal-500/50"
            />
            <span className="text-sm font-medium text-slate-300">Active</span>
          </label>
        </div>
      </div>

      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4a] p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-white">HTML Body *</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button
                onClick={() => { setShowQuickMenu(!showQuickMenu); setShowVarMenu(false); }}
                className="px-4 py-2 bg-indigo-500/15 text-indigo-400 rounded-lg hover:bg-indigo-500/25 transition-colors text-sm font-medium whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-add-box-line"></i>
                Quick Insert
                {showQuickMenu ? <i className="ri-arrow-up-s-line text-xs"></i> : <i className="ri-arrow-down-s-line text-xs"></i>}
              </button>
              {showQuickMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-[#111d35] border border-[#1e2d4a] rounded-xl shadow-xl z-30 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Insert Block</p>
                  <div className="space-y-1">
                    {quickInserts.map((qi) => (
                      <button
                        key={qi.label}
                        onClick={() => { insertAtCursor('\n' + qi.html + '\n'); setShowQuickMenu(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-7 h-7 flex items-center justify-center bg-indigo-500/15 rounded-lg shrink-0">
                          <i className={`${qi.icon} text-indigo-400 text-sm`}></i>
                        </div>
                        <span className="text-sm font-medium text-slate-300">{qi.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowVarMenu(!showVarMenu); setShowQuickMenu(false); }}
                className="px-4 py-2 bg-slate-500/15 text-slate-300 rounded-lg hover:bg-slate-500/25 transition-colors text-sm font-medium whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-braces-line"></i>
                Insert Variable
                {showVarMenu ? <i className="ri-arrow-up-s-line text-xs"></i> : <i className="ri-arrow-down-s-line text-xs"></i>}
              </button>
              {showVarMenu && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-[#111d35] border border-[#1e2d4a] rounded-xl shadow-xl z-30 p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Common Variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {commonVariables.map(v => (
                      <button
                        key={v}
                        onClick={() => { insertVariable(v); setShowVarMenu(false); }}
                        className="px-2.5 py-1 bg-teal-500/15 text-teal-400 rounded-full text-xs font-mono hover:bg-teal-500/25 transition-colors"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <textarea
          ref={editorRef}
          value={formData.body_html}
          onChange={(e) => update('body_html', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-[420px] px-4 py-3 border border-[#1e2d4a] rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-sm font-mono resize-none bg-[#0a1628] text-slate-200 placeholder:text-slate-500"
          placeholder={`<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body style="font-family:Arial,sans-serif;">\n  <h1>Hello {'{{'}first_name{'}}'}!</h1>\n</body>\n</html>`}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving || !formData.name || !formData.template_slug || !formData.body_html || !formData.subject}
          className="flex-1 px-5 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-semibold whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <i className="ri-save-line"></i>
              {isEditing ? 'Save Changes' : 'Create Template'}
            </>
          )}
        </button>
        {isEditing && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-5 py-3 border border-[#1e2d4a] text-slate-300 rounded-lg hover:bg-white/5 transition-colors font-medium whitespace-nowrap disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}