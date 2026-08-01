'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import TemplateList from './TemplateList';
import TemplateEditor from './TemplateEditor';
import TemplatePreview from './TemplatePreview';
import TestSendModal from './TestSendModal';
import ImageLibrary from './ImageLibrary';

interface EmailTemplate {
  id: string;
  name: string;
  template_slug: string;
  subject: string;
  body_html: string;
  category: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateFormData {
  name: string;
  template_slug: string;
  subject: string;
  body_html: string;
  category: string;
  description: string;
  is_active: boolean;
}

const emptyForm: TemplateFormData = {
  name: '',
  template_slug: '',
  subject: '',
  body_html: '',
  category: 'all',
  description: '',
  is_active: true,
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm);
  const [showPreview, setShowPreview] = useState(false);
  const [showTestSend, setShowTestSend] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [mode, setMode] = useState<'list' | 'edit' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<'templates' | 'images'>('templates');
  const [imageToInsert, setImageToInsert] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedId(null);
    setFormData(emptyForm);
    setMode('create');
    setActiveTab('templates');
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedId(template.id);
    setFormData({
      name: template.name || '',
      template_slug: template.template_slug || '',
      subject: template.subject || '',
      body_html: template.body_html || '',
      category: template.category || 'all',
      description: template.description || '',
      is_active: template.is_active,
    });
    setMode('edit');
    setActiveTab('templates');
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    const newSlug = template.template_slug + '-copy';
    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        name: template.name + ' (Copy)',
        template_slug: newSlug,
        subject: template.subject,
        body_html: template.body_html,
        category: template.category,
        description: template.description,
        is_active: false,
      })
      .select()
      .maybeSingle();

    if (error) {
      showToast('Failed to duplicate: ' + error.message, 'error');
      return;
    }

    if (!data) {
      showToast('Failed to duplicate: no data returned', 'error');
      return;
    }

    showToast('Template duplicated');
    fetchTemplates();
    handleEdit(data);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        template_slug: formData.template_slug,
        subject: formData.subject,
        body_html: formData.body_html,
        category: formData.category,
        description: formData.description,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (selectedId) {
        const { error } = await supabase
          .from('email_templates')
          .update(payload)
          .eq('id', selectedId);
        if (error) throw error;
        showToast('Template updated');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select()
          .maybeSingle();
        if (error) throw error;
        showToast('Template created');
      }

      fetchTemplates();
      setSelectedId(null);
      setFormData(emptyForm);
      setMode('list');
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
      showToast('Template deleted');
      if (selectedId === id) {
        setSelectedId(null);
        setFormData(emptyForm);
      }
      fetchTemplates();
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const handleCancelEdit = () => {
    setSelectedId(null);
    setFormData(emptyForm);
    setMode('list');
  };

  const handleInsertImage = (html: string) => {
    if (mode === 'list') {
      handleCreate();
      setTimeout(() => {
        setImageToInsert(html);
      }, 100);
      setActiveTab('templates');
      return;
    }
    setImageToInsert(html);
    setActiveTab('templates');
  };

  const handleImageInsertHandled = () => {
    setImageToInsert(null);
  };

  const vars = ['first_name','email','job_title','venue','date','time','amount','plan_name','pay_rate','dashboard_url','support_email','client_name','guard_name','location','address','start_time'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading email templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Email Templates</h1>
          <p className="text-sm text-slate-400">
            {activeTab === 'templates'
              ? `${templates.length} templates \u00b7 ${templates.filter(t => t.is_active).length} active`
              : `Image Library`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#0a1628] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'templates' ? 'bg-[#111d35] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
                <i className="ri-mail-settings-line"></i>
              </div>
              Templates
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'images' ? 'bg-[#111d35] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center inline mr-1.5">
                <i className="ri-image-line"></i>
              </div>
              Image Library
            </button>
          </div>
          {activeTab === 'templates' && mode === 'list' && (
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors font-medium whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-add-line"></i>
              New Template
            </button>
          )}
        </div>
      </div>

      {activeTab === 'images' && (
        <ImageLibrary onInsertImage={handleInsertImage} />
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {mode === 'list' && (
            <div className="lg:col-span-5">
              <TemplateList
                templates={templates}
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                onSearchChange={setSearchQuery}
                onCategoryChange={setCategoryFilter}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPreview={(t) => {
                  handleEdit(t);
                  setShowPreview(true);
                }}
                onCreate={handleCreate}
                onDuplicate={handleDuplicate}
              />
            </div>
          )}

          {mode === 'edit' && (
            <>
              <div className="lg:col-span-2">
                <TemplateList
                  templates={templates}
                  searchQuery={searchQuery}
                  categoryFilter={categoryFilter}
                  onSearchChange={setSearchQuery}
                  onCategoryChange={setCategoryFilter}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPreview={(t) => {
                    handleEdit(t);
                    setShowPreview(true);
                  }}
                  onCreate={handleCreate}
                  onDuplicate={handleDuplicate}
                />
              </div>
              <div className="lg:col-span-3">
                <TemplateEditor
                  formData={formData}
                  onChange={setFormData}
                  isEditing={true}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                  onTestSend={() => setShowTestSend(true)}
                  onPreview={() => setShowPreview(true)}
                  imageToInsert={imageToInsert}
                  onImageInsertHandled={handleImageInsertHandled}
                />
              </div>
            </>
          )}

          {mode === 'create' && (
            <div className="lg:col-span-5">
              <TemplateEditor
                formData={formData}
                onChange={setFormData}
                isEditing={false}
                saving={saving}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                onTestSend={() => setShowTestSend(true)}
                onPreview={() => setShowPreview(true)}
                imageToInsert={imageToInsert}
                onImageInsertHandled={handleImageInsertHandled}
              />
            </div>
          )}
        </div>
      )}

      <TemplatePreview
        bodyHtml={formData.body_html}
        subject={formData.subject}
        variables={vars}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />

      <TestSendModal
        templateSlug={formData.template_slug}
        variables={vars}
        subject={formData.subject}
        isOpen={showTestSend}
        onClose={() => setShowTestSend(false)}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}