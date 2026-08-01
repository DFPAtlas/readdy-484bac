'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface Task {
  id: string;
  app_slug: string;
  task_type: 'roadmap' | 'todo' | 'bug' | 'launch_blocker';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'backlog' | 'in_progress' | 'blocked' | 'done';
  assigned_owner: string;
  due_date: string | null;
  completed_at: string | null;
}

interface TaskEditModalProps {
  task: Task | null;
  projectName: string;
  onClose: () => void;
  onSaved: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function TaskEditModal({ task, projectName, onClose, onSaved, showToast }: TaskEditModalProps) {
  const admin = useAdminAuth();
  const isEditing = task !== null;

  const [form, setForm] = useState({
    task_type: task?.task_type || 'todo',
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    status: task?.status || 'backlog',
    assigned_owner: task?.assigned_owner || '',
    due_date: task?.due_date || '',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const adminUsername = admin.username || 'admin';
      const adminName = admin.name || adminUsername;
      const slug = projectName.toLowerCase();

      const payload = {
        app_slug: slug,
        task_type: form.task_type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        assigned_owner: form.assigned_owner.trim() || null,
        due_date: form.due_date || null,
        completed_at: form.status === 'done' ? new Date().toISOString() : task?.completed_at || null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (isEditing) {
        result = await supabase
          .from('digital_footprint_project_tasks')
          .update(payload)
          .eq('id', task!.id)
          .select()
          .maybeSingle();
      } else {
        result = await supabase
          .from('digital_footprint_project_tasks')
          .insert({ ...payload, id: undefined })
          .select()
          .maybeSingle();
      }

      if (result.error) {
        showToast('Failed to save: ' + result.error.message, 'error');
        setSaving(false);
        return;
      }

      await supabase.from('admin_activity_log').insert({
        admin_username: adminUsername,
        admin_name: adminName,
        action_type: isEditing ? 'update_project_task' : 'create_project_task',
        action_description: isEditing
          ? `Updated task "${form.title}" for ${projectName}`
          : `Created task "${form.title}" for ${projectName}`,
        target_type: 'digital_footprint_project_tasks',
        target_name: projectName,
        metadata: { task: payload, previous_task_id: task?.id || null },
      });

      showToast(isEditing ? 'Task updated' : 'Task created', 'success');
      onSaved();
    } catch (err) {
      console.error('Save error:', err);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2b4a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <i className={isEditing ? 'ri-edit-line' : 'ri-add-line'}></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'Edit Task' : 'New Task'}
              </h3>
              <p className="text-[10px] text-slate-500">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional details..."
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 resize-none"
              rows={2}
              maxLength={500}
            />
            <p className="text-[9px] text-slate-600 mt-1 text-right">{form.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'roadmap', label: 'Roadmap', icon: 'ri-road-map-line' },
                  { value: 'todo', label: 'To-Do', icon: 'ri-checkbox-line' },
                  { value: 'bug', label: 'Bug', icon: 'ri-bug-line' },
                  { value: 'launch_blocker', label: 'Blocker', icon: 'ri-alert-line' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateField('task_type', opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                      form.task_type === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-indigo-500/30 hover:text-white'
                    }`}
                  >
                    <div className="w-3 h-3 flex items-center justify-center"><i className={opt.icon + ' text-[9px]'}></i></div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Priority</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: 'critical', label: 'Critical' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateField('priority', opt.value)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                      form.priority === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-[#0a1628] text-slate-400 border-[#1a2b4a] hover:border-indigo-500/30 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-2 pr-8 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 cursor-pointer"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => updateField('due_date', e.target.value)}
                className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Owner</label>
            <input
              type="text"
              value={form.assigned_owner}
              onChange={(e) => updateField('assigned_owner', e.target.value)}
              placeholder="e.g. Martin, Engineering team..."
              className="w-full px-3 py-2 bg-[#0a1628] border border-[#1a2b4a] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#1a2b4a]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-900/50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-loader-4-line animate-spin"></i></div>
                Saving...
              </>
            ) : (
              <>
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-save-line"></i></div>
                {isEditing ? 'Update' : 'Create'} Task
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}