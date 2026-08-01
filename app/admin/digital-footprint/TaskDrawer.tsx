'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import TaskEditModal from './TaskEditModal';

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
  created_at: string;
  updated_at: string;
}

interface TaskDrawerProps {
  projectName: string;
  onClose: () => void;
  isSuperAdmin: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  roadmap: { label: 'Roadmap', icon: 'ri-road-map-line', color: 'text-violet-400 bg-violet-500/10' },
  todo: { label: 'To-Do', icon: 'ri-checkbox-line', color: 'text-sky-400 bg-sky-500/10' },
  bug: { label: 'Bug', icon: 'ri-bug-line', color: 'text-red-400 bg-red-500/10' },
  launch_blocker: { label: 'Launch Blocker', icon: 'ri-alert-line', color: 'text-amber-400 bg-amber-500/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  high: { label: 'High', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  medium: { label: 'Medium', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  low: { label: 'Low', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  backlog: { label: 'Backlog', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  in_progress: { label: 'In Progress', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  blocked: { label: 'Blocked', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  done: { label: 'Done', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

export default function TaskDrawer({ projectName, onClose, isSuperAdmin, showToast }: TaskDrawerProps) {
  const admin = useAdminAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'roadmap' | 'todo' | 'bug' | 'launch_blocker'>('all');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const slug = projectName.toLowerCase();
    const { data, error } = await supabase
      .from('digital_footprint_project_tasks')
      .select('*')
      .eq('app_slug', slug)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetch tasks error:', error);
    }
    setTasks(data || []);
    setLoading(false);
  }, [projectName]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDelete = async (taskId: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('Delete this task? This cannot be undone.')) return;

    const { error } = await supabase
      .from('digital_footprint_project_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      showToast('Failed to delete: ' + error.message, 'error');
      return;
    }

    const adminUsername = admin.username || 'admin';
    const adminName = admin.name || adminUsername;
    await supabase.from('admin_activity_log').insert({
      admin_username: adminUsername,
      admin_name: adminName,
      action_type: 'delete_project_task',
      action_description: `Deleted task from ${projectName}`,
      target_type: 'digital_footprint_project_tasks',
      target_name: projectName,
      metadata: { task_id: taskId },
    });

    showToast('Task deleted', 'success');
    fetchTasks();
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (!isSuperAdmin) return;

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'done') {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('digital_footprint_project_tasks')
      .update(updates)
      .eq('id', task.id);

    if (error) {
      showToast('Failed to update status: ' + error.message, 'error');
      return;
    }
    fetchTasks();
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'done') return false;
    return new Date(task.due_date) < new Date();
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.task_type === filter);

  const typeCounts = {
    roadmap: tasks.filter((t) => t.task_type === 'roadmap').length,
    todo: tasks.filter((t) => t.task_type === 'todo').length,
    bug: tasks.filter((t) => t.task_type === 'bug').length,
    launch_blocker: tasks.filter((t) => t.task_type === 'launch_blocker').length,
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div
          className="relative w-full max-w-xl bg-[#111d35] border-l border-[#1a2b4a] h-full flex flex-col shadow-2xl animate-slide-in-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2b4a] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <i className="ri-task-line"></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{projectName}</h3>
                <p className="text-[10px] text-slate-500">{tasks.length} tasks total</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>

          <div className="flex items-center gap-1 px-5 py-2 border-b border-[#1a2b4a] flex-shrink-0 overflow-x-auto">
            {[{ key: 'all', label: 'All', count: tasks.length }, ...Object.entries(TASK_TYPE_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, count: typeCounts[key as keyof typeof typeCounts] }))].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#0a1628] text-slate-400 hover:text-white hover:bg-[#1a2b4a]'
                }`}
              >
                {tab.label}
                <span className={`text-[9px] ${filter === tab.key ? 'text-white/70' : 'text-slate-600'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 flex items-center justify-center text-indigo-400">
                  <i className="ri-loader-4-line animate-spin text-2xl"></i>
                </div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-600">
                  <i className="ri-inbox-line text-2xl"></i>
                </div>
                <p className="text-sm text-slate-500 font-medium">No tasks found</p>
                <p className="text-[11px] text-slate-600">
                  {filter === 'all' ? 'Add your first task to get started' : 'No tasks in this category'}
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const typeCfg = TASK_TYPE_CONFIG[task.task_type];
                const priorityCfg = PRIORITY_CONFIG[task.priority];
                const statusCfg = STATUS_CONFIG[task.status];
                const overdue = isOverdue(task);

                return (
                  <div
                    key={task.id}
                    className={`bg-[#0a1628] rounded-xl border p-4 transition-all ${
                      overdue ? 'border-red-500/30' : task.status === 'blocked' ? 'border-amber-500/30' : 'border-[#1a2b4a]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => handleStatusChange(task, task.status === 'done' ? 'backlog' : 'done')}
                            className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-all cursor-pointer ${
                              task.status === 'done'
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'border-slate-600 hover:border-emerald-500/50'
                            }`}
                          >
                            {task.status === 'done' && <i className="ri-check-line text-white text-xs"></i>}
                          </button>
                        ) : (
                          <div className={`w-5 h-5 flex items-center justify-center rounded border-2 ${
                            task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                          }`}>
                            {task.status === 'done' && <i className="ri-check-line text-white text-xs"></i>}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeCfg.color}`}>
                            <div className="w-2.5 h-2.5 flex items-center justify-center"><i className={typeCfg.icon + ' text-[8px]'}></i></div>
                            {typeCfg.label}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${priorityCfg.cls}`}>
                            {priorityCfg.label}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                          {overdue && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 whitespace-nowrap">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-600">
                          {task.assigned_owner && (
                            <span className="inline-flex items-center gap-1">
                              <div className="w-3 h-3 flex items-center justify-center"><i className="ri-user-line text-[8px]"></i></div>
                              {task.assigned_owner}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-400 font-semibold' : ''}`}>
                              <div className="w-3 h-3 flex items-center justify-center"><i className="ri-calendar-line text-[8px]"></i></div>
                              {new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSuperAdmin && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className="bg-[#0a1628] border border-[#1a2b4a] rounded-lg text-[9px] font-semibold text-slate-300 px-2 py-1 pr-6 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            onClick={() => setEditTask(task)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-indigo-400 hover:bg-[#1a2b4a] transition-all cursor-pointer"
                          >
                            <i className="ri-edit-line text-[10px]"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-red-400 hover:bg-[#1a2b4a] transition-all cursor-pointer"
                          >
                            <i className="ri-delete-bin-line text-[10px]"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isSuperAdmin && (
            <div className="px-5 py-4 border-t border-[#1a2b4a] flex-shrink-0">
              <button
                onClick={() => setCreating(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-indigo-900/50"
              >
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-add-line"></i></div>
                Add Task
              </button>
            </div>
          )}
        </div>
      </div>

      {(editTask || creating) && (
        <TaskEditModal
          task={editTask}
          projectName={projectName}
          onClose={() => { setEditTask(null); setCreating(false); }}
          onSaved={() => { fetchTasks(); setEditTask(null); setCreating(false); }}
          showToast={showToast}
        />
      )}
    </>
  );
}