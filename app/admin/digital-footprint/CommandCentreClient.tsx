'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ProjectEditModal from './ProjectEditModal';
import TaskDrawer from './TaskDrawer';
import DeploymentStatusWidget from './DeploymentStatusWidget';
import DeploymentDetailModal from './DeploymentDetailModal';
import BackupStatusWidget from './BackupStatusWidget';
import BackupDetailModal from './BackupDetailModal';
import SearchAndFilterBar from './SearchAndFilterBar';
import NotificationBell from './NotificationBell';
import StripeFinanceWidget from './StripeFinanceWidget';
import StripeRevenueChart from './StripeRevenueChart';
import ExportButton from './ExportButton';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface PlatformCost {
  id: string;
  service_name: string;
  category: string;
  monthly_cost: number;
  notes: string | null;
  supplier: string | null;
  billing_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectMetric {
  id: string;
  project_name: string;
  monthly_running_cost: number | null;
  notes: string | null;
  current_blockers: string | null;
  launch_target_date: string | null;
  current_build_status: string | null;
  latest_deployment_notes: string | null;
  manual_health_status: string | null;
  manual_revenue_estimate: number | null;
  is_archived: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

type ProjectRow = {
  projectName: string;
  category: string;
  automatedCost: number | null;
  automatedNotes: string | null;
  automatedSupplier: string | null;
  automatedBillingDate: string | null;
  platformCostId: string | null;
  metricId: string | null;
  manualCost: number | null;
  manualNotes: string | null;
  manualBlockers: string | null;
  manualLaunchDate: string | null;
  manualBuildStatus: string | null;
  manualDeployNotes: string | null;
  manualHealth: string | null;
  manualRevenue: number | null;
  isArchived: boolean;
  metricUpdatedAt: string | null;
};

interface DeploymentInfo {
  id: string | null;
  github_url: string | null;
  branch_name: string | null;
  commit_hash: string | null;
  commit_message: string | null;
  deployment_status: string | null;
  build_status: string | null;
  build_error_summary: string | null;
  deployed_at: string | null;
}

interface BackupInfo {
  id: string | null;
  backup_type: string | null;
  backup_status: string | null;
  backup_location: string | null;
  last_backup_at: string | null;
  recovery_test_status: string | null;
  last_recovery_test_at: string | null;
  recovery_notes: string | null;
}

interface FilterState {
  buildStatus: string | null;
  healthStatus: string | null;
  hasCriticalAlerts: boolean;
  hasBlockedTasks: boolean;
  hasFailedBuilds: boolean;
  hasFailedBackups: boolean;
  showArchived: boolean | null;
}

export default function CommandCentreClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProject, setEditProject] = useState<ProjectRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [taskProject, setTaskProject] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<Record<string, DeploymentInfo>>({});
  const [deploymentProject, setDeploymentProject] = useState<string | null>(null);
  const [backups, setBackups] = useState<Record<string, BackupInfo>>({});
  const [backupProject, setBackupProject] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchSlugs, setSearchSlugs] = useState<Set<string>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adminAuth = useAdminAuth();
  const isSuperAdmin = adminAuth.role === 'super_admin';

  const [filters, setFilters] = useState<FilterState>({
    buildStatus: null,
    healthStatus: null,
    hasCriticalAlerts: false,
    hasBlockedTasks: false,
    hasFailedBuilds: false,
    hasFailedBackups: false,
    showArchived: false,
  });

  const [blockedTaskSlugs, setBlockedTaskSlugs] = useState<Set<string>>(new Set());
  const [failedBuildSlugs, setFailedBuildSlugs] = useState<Set<string>>(new Set());
  const [failedBackupSlugs, setFailedBackupSlugs] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTaskCounts = useCallback(async (projectNames: string[]) => {
    const slugs = projectNames.map((n) => n.toLowerCase());
    if (slugs.length === 0) return;
    const { data } = await supabase
      .from('digital_footprint_project_tasks')
      .select('app_slug, status')
      .in('app_slug', slugs)
      .neq('status', 'done');
    const counts: Record<string, number> = {};
    const blockedSet = new Set<string>();
    (data || []).forEach((t: { app_slug: string; status: string }) => {
      counts[t.app_slug] = (counts[t.app_slug] || 0) + 1;
      if (t.status === 'blocked') {
        blockedSet.add(t.app_slug);
      }
    });
    setTaskCounts(counts);
    setBlockedTaskSlugs(blockedSet);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: costs, error: costErr }, { data: metrics, error: metricErr }, { data: deploys, error: deployErr }, { data: backupRows, error: backupErr }] = await Promise.all([
        supabase.from('platform_costs').select('*').order('category').order('service_name'),
        supabase.from('project_metrics').select('*'),
        supabase.from('digital_footprint_deployments').select('*'),
        supabase.from('digital_footprint_backups').select('*'),
      ]);

      if (costErr) console.error('platform_costs error:', costErr);
      if (metricErr) console.error('project_metrics error:', metricErr);
      if (deployErr) console.error('deployments error:', deployErr);
      if (backupErr) console.error('backups error:', backupErr);

      const costsArr: PlatformCost[] = costs || [];
      const metricsArr: ProjectMetric[] = metrics || [];
      const metricsMap = new Map<string, ProjectMetric>();
      metricsArr.forEach((m) => metricsMap.set(m.project_name.toLowerCase(), m));

      const deploysArr: DeploymentInfo[] = deploys || [];
      const deployMap = new Map<string, DeploymentInfo>();
      deploysArr.forEach((d) => deployMap.set(d.app_slug || '', d));

      const backupArr: BackupInfo[] = backupRows || [];
      const backupMap = new Map<string, BackupInfo>();
      backupArr.forEach((b) => backupMap.set(b.app_slug || '', b));

      const allProjectNames = new Set<string>();
      costsArr.forEach((c) => allProjectNames.add(c.service_name.toLowerCase()));
      metricsArr.forEach((m) => allProjectNames.add(m.project_name.toLowerCase()));

      const rows: ProjectRow[] = [];

      allProjectNames.forEach((nameLower) => {
        const cost = costsArr.find((c) => c.service_name.toLowerCase() === nameLower);
        const metric = metricsMap.get(nameLower);

        rows.push({
          projectName: cost?.service_name || metric?.project_name || nameLower,
          category: cost?.category || 'uncategorised',
          automatedCost: cost?.monthly_cost ?? null,
          automatedNotes: cost?.notes ?? null,
          automatedSupplier: cost?.supplier ?? null,
          automatedBillingDate: cost?.billing_date ?? null,
          platformCostId: cost?.id ?? null,
          metricId: metric?.id ?? null,
          manualCost: metric?.monthly_running_cost ?? null,
          manualNotes: metric?.notes ?? null,
          manualBlockers: metric?.current_blockers ?? null,
          manualLaunchDate: metric?.launch_target_date ?? null,
          manualBuildStatus: metric?.current_build_status ?? null,
          manualDeployNotes: metric?.latest_deployment_notes ?? null,
          manualHealth: metric?.manual_health_status ?? null,
          manualRevenue: metric?.manual_revenue_estimate ?? null,
          isArchived: metric?.is_archived ?? false,
          metricUpdatedAt: metric?.updated_at ?? null,
        });
      });

      rows.sort((a, b) => {
        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
        return a.projectName.localeCompare(b.projectName);
      });

      setProjects(rows);
      setDeployments(Object.fromEntries(deployMap));
      setBackups(Object.fromEntries(backupMap));
      fetchTaskCounts(rows.map((r) => r.projectName));
    } catch (err) {
      console.error('fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchTaskCounts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchSlugs(new Set());
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const query = searchQuery.trim().toLowerCase();
      const allSlugs = projects.map((p) => p.projectName.toLowerCase());
      const matchingSlugs = new Set<string>();

      projects.forEach((p) => {
        if (p.projectName.toLowerCase().includes(query)) {
          matchingSlugs.add(p.projectName.toLowerCase());
        }
      });

      try {
        const [{ data: tasks }, { data: deploys }, { data: backupRows }] = await Promise.all([
          allSlugs.length > 0
            ? supabase.from('digital_footprint_project_tasks').select('app_slug').in('app_slug', allSlugs).ilike('title', '%' + query + '%')
            : Promise.resolve({ data: [] }),
          allSlugs.length > 0
            ? supabase.from('digital_footprint_deployments').select('app_slug').in('app_slug', allSlugs).ilike('commit_message', '%' + query + '%')
            : Promise.resolve({ data: [] }),
          allSlugs.length > 0
            ? supabase.from('digital_footprint_backups').select('app_slug').in('app_slug', allSlugs).ilike('recovery_notes', '%' + query + '%')
            : Promise.resolve({ data: [] }),
        ]);

        (tasks || []).forEach((t: { app_slug: string }) => matchingSlugs.add(t.app_slug));
        (deploys || []).forEach((d: { app_slug: string }) => matchingSlugs.add(d.app_slug));
        (backupRows || []).forEach((b: { app_slug: string }) => matchingSlugs.add(b.app_slug));
      } catch (err) {
        console.error('search error:', err);
      }

      setSearchSlugs(matchingSlugs);
      setSearchLoading(false);
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, projects]);

  useEffect(() => {
    const buildSet = new Set<string>();
    Object.entries(deployments).forEach(([slug, d]) => {
      if (d.build_status === 'failed') {
        buildSet.add(slug);
      }
    });
    setFailedBuildSlugs(buildSet);
  }, [deployments]);

  useEffect(() => {
    const backupSet = new Set<string>();
    Object.entries(backups).forEach(([slug, b]) => {
      if (b.backup_status === 'failed') {
        backupSet.add(slug);
      }
    });
    setFailedBackupSlugs(backupSet);
  }, [backups]);

  const handleSaved = () => {
    fetchData();
    setEditProject(null);
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '\u2014';
    return '\u00A3' + val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getBuildStatusBadge = (status: string | null) => {
    if (!status) return null;
    const map: Record<string, { label: string; cls: string }> = {
      planning: { label: 'Planning', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
      in_progress: { label: 'In Progress', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
      uat: { label: 'UAT', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      ready: { label: 'Ready', cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
      live: { label: 'Live', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      maintenance: { label: 'Maintenance', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
      archived: { label: 'Archived', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const item = map[status] || { label: status, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${item.cls}`}>
        {item.label}
      </span>
    );
  };

  const getHealthBadge = (status: string | null) => {
    if (!status) return null;
    const map: Record<string, { label: string; cls: string; icon: string }> = {
      healthy: { label: 'Healthy', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'ri-check-double-line' },
      degraded: { label: 'Degraded', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'ri-error-warning-line' },
      critical: { label: 'Critical', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: 'ri-close-circle-line' },
      unknown: { label: 'Unknown', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: 'ri-question-line' },
    };
    const item = map[status] || { label: status, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: 'ri-question-line' };
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${item.cls}`}>
        <div className="w-3 h-3 flex items-center justify-center"><i className={item.icon + ' text-[9px]'}></i></div>
        {item.label}
      </span>
    );
  };

  const hasManualOverrides = (p: ProjectRow) =>
    p.manualCost !== null ||
    p.manualNotes !== null ||
    p.manualBlockers !== null ||
    p.manualLaunchDate !== null ||
    p.manualBuildStatus !== null ||
    p.manualDeployNotes !== null ||
    p.manualHealth !== null ||
    p.manualRevenue !== null;

  const getTaskCount = (p: ProjectRow) => taskCounts[p.projectName.toLowerCase()] || 0;

  const hasAnyFilter = () =>
    !!filters.buildStatus ||
    !!filters.healthStatus ||
    filters.hasCriticalAlerts ||
    filters.hasBlockedTasks ||
    filters.hasFailedBuilds ||
    filters.hasFailedBackups ||
    filters.showArchived !== false;

  const activeProjects = projects.filter((p) => !p.isArchived);
  const archivedProjects = projects.filter((p) => p.isArchived);

  const isSearching = searchQuery.trim().length > 0;

  const filteredProjects = projects.filter((p) => {
    const slug = p.projectName.toLowerCase();

    if (isSearching && !searchSlugs.has(slug)) {
      return false;
    }

    if (filters.buildStatus && p.manualBuildStatus !== filters.buildStatus) {
      return false;
    }

    if (filters.healthStatus && p.manualHealth !== filters.healthStatus) {
      return false;
    }

    if (filters.hasCriticalAlerts && p.manualHealth !== 'critical') {
      return false;
    }

    if (filters.hasBlockedTasks && !blockedTaskSlugs.has(slug)) {
      return false;
    }

    if (filters.hasFailedBuilds && !failedBuildSlugs.has(slug)) {
      return false;
    }

    if (filters.hasFailedBackups && !failedBackupSlugs.has(slug)) {
      return false;
    }

    if (filters.showArchived === true && !p.isArchived) {
      return false;
    }
    if (filters.showArchived === false && p.isArchived) {
      return false;
    }

    return true;
  });

  const filteredActive = filteredProjects.filter((p) => !p.isArchived);
  const filteredArchived = filteredProjects.filter((p) => p.isArchived);

  const totalMonthlyAutomated = activeProjects.reduce((sum, p) => sum + (p.automatedCost || 0), 0);
  const totalMonthlyManual = activeProjects.reduce((sum, p) => sum + (p.manualCost || p.automatedCost || 0), 0);

  const renderProjectRow = (p: ProjectRow) => {
    const count = getTaskCount(p);
    return (
      <tr key={p.projectName} className="hover:bg-[#0a1628]/50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-md bg-[#0a1628] text-indigo-400">
              <i className="ri-code-box-line text-[11px]"></i>
            </div>
            <span className="text-white font-medium text-[11px]">{p.projectName}</span>
            {hasManualOverrides(p) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                Manual override
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-[10px] font-medium text-slate-400 bg-[#0a1628] px-2 py-0.5 rounded-full whitespace-nowrap capitalize">{p.category}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-slate-400 text-[11px] font-mono">{formatCurrency(p.automatedCost)}</span>
          {p.automatedSupplier && (
            <p className="text-[9px] text-slate-600 mt-0.5">{p.automatedSupplier}</p>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {p.manualCost !== null ? (
            <span className="text-indigo-400 text-[11px] font-mono font-semibold">{formatCurrency(p.manualCost)}</span>
          ) : (
            <span className="text-slate-600 text-[11px]">{'\u2014'}</span>
          )}
        </td>
        <td className="px-4 py-3">
          {getBuildStatusBadge(p.manualBuildStatus) || <span className="text-slate-600 text-[10px]">{'\u2014'}</span>}
        </td>
        <td className="px-4 py-3">
          {getHealthBadge(p.manualHealth) || <span className="text-slate-600 text-[10px]">{'\u2014'}</span>}
        </td>
        <td className="px-4 py-3">
          <DeploymentStatusWidget
            deployment={deployments[p.projectName.toLowerCase()] || null}
            onClick={() => setDeploymentProject(p.projectName)}
          />
        </td>
        <td className="px-4 py-3">
          <BackupStatusWidget
            backup={backups[p.projectName.toLowerCase()] || null}
            onClick={() => setBackupProject(p.projectName)}
          />
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => setTaskProject(p.projectName)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
              count > 0
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20 hover:text-white'
                : 'bg-[#0a1628] text-slate-600 border-[#1a2b4a] hover:border-violet-500/30 hover:text-slate-400'
            }`}
          >
            <div className="w-3 h-3 flex items-center justify-center"><i className={count > 0 ? 'ri-task-line' : 'ri-add-line text-[9px]'}></i></div>
            {count > 0 ? count : 'Add'}
          </button>
        </td>
        <td className="px-4 py-3">
          {p.manualBlockers ? (
            <span className="text-red-400 text-[10px] line-clamp-1 max-w-[160px]">{p.manualBlockers}</span>
          ) : (
            <span className="text-emerald-400 text-[10px] font-medium">None</span>
          )}
        </td>
        <td className="px-4 py-3">
          {p.metricUpdatedAt ? (
            <span className="text-slate-500 text-[10px] font-mono">
              {new Date(p.metricUpdatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
          ) : (
            <span className="text-slate-600 text-[10px]">{'\u2014'}</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isSuperAdmin ? (
            <button
              onClick={() => setEditProject(p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-all cursor-pointer whitespace-nowrap border border-indigo-500/20 hover:border-indigo-500/40"
            >
              <div className="w-3 h-3 flex items-center justify-center"><i className="ri-edit-line text-[10px]"></i></div>
              Edit
            </button>
          ) : (
            <span className="text-[10px] text-slate-600 italic">super-admin only</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-900/50">
                <i className="ri-footprint-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">Digital-Footprint Command Centre</h1>
                <p className="text-[11px] text-slate-500 font-medium">Infrastructure projects &amp; cost overview</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1a2b4a] transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-refresh-line text-base"></i>
              </div>
              Refresh
            </button>
            <ExportButton projects={projects} />
            <NotificationBell isSuperAdmin={isSuperAdmin} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        {toast && (
          <div className={`fixed top-20 right-8 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className="w-4 h-4 flex items-center justify-center">
              <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-close-line'}></i>
            </div>
            {toast.message}
          </div>
        )}

        <div className="mb-6">
          <SearchAndFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            isSuperAdmin={isSuperAdmin}
            blockedTaskSlugs={blockedTaskSlugs}
            failedBuildSlugs={failedBuildSlugs}
            failedBackupSlugs={failedBackupSlugs}
          />
        </div>

        {isSearching && searchLoading && (
          <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-500">
            <div className="w-3 h-3 flex items-center justify-center">
              <i className="ri-loader-4-line animate-spin text-[10px]"></i>
            </div>
            Searching across projects, tasks, deployments &amp; backups…
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <i className="ri-stack-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Projects</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{activeProjects.length}</p>
            <p className="text-[10px] text-slate-500 mt-1">{archivedProjects.length} archived</p>
          </div>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <i className="ri-money-pound-circle-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auto Monthly Cost</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{formatCurrency(totalMonthlyAutomated)}</p>
            <p className="text-[10px] text-slate-500 mt-1">from platform_costs</p>
          </div>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <i className="ri-user-settings-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Manual Monthly Cost</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{formatCurrency(totalMonthlyManual)}</p>
            <p className="text-[10px] text-slate-500 mt-1">manual overrides where set</p>
          </div>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                <i className="ri-task-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Tasks</span>
            </div>
            <p className="text-2xl font-extrabold text-white">
              {Object.values(taskCounts).reduce((a, b) => a + b, 0)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">across all projects</p>
          </div>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <i className="ri-shield-check-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Projects w/ Overrides</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{projects.filter(hasManualOverrides).length}</p>
            <p className="text-[10px] text-slate-500 mt-1">of {projects.length} total</p>
          </div>
          <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <i className="ri-rocket-2-line text-lg"></i>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deployments</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{Object.keys(deployments).length}</p>
            <p className="text-[10px] text-slate-500 mt-1">being tracked</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StripeRevenueChart />
          <StripeFinanceWidget />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 flex items-center justify-center text-teal-400">
              <i className="ri-loader-4-line animate-spin text-2xl"></i>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Active Projects {isSearching || hasAnyFilter() ? `(${filteredActive.length})` : ''}</h2>
              <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Project</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Category</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-400">Automated Cost</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-400">Manual Cost</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Build Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Health</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Deployment</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Backup</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-400">Tasks</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Blockers</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-400">Last Updated</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2b4a]">
                      {filteredActive.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0a1628] text-slate-600">
                                <i className="ri-inbox-line text-xl"></i>
                              </div>
                              <p className="text-sm text-slate-500 font-medium">
                                {isSearching || hasAnyFilter() ? 'No matching projects found' : 'No projects found'}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {isSearching || hasAnyFilter() ? 'Try adjusting your search or filters' : 'Add services to platform_costs or create manual entries in project_metrics'}
                              </p>
                              {(isSearching || hasAnyFilter()) && (
                                <button
                                  onClick={() => { setSearchQuery(''); setFilters({ buildStatus: null, healthStatus: null, hasCriticalAlerts: false, hasBlockedTasks: false, hasFailedBuilds: false, hasFailedBackups: false, showArchived: false }); }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-all cursor-pointer whitespace-nowrap border border-indigo-500/20"
                                >
                                  <div className="w-3 h-3 flex items-center justify-center"><i className="ri-refresh-line text-[10px]"></i></div>
                                  Clear all filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredActive.map((p) => renderProjectRow(p))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {filteredArchived.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Archived Projects</h2>
                <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] overflow-hidden opacity-60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1a2b4a] bg-[#0a1628]">
                          <th className="text-left px-4 py-3 font-semibold text-slate-400">Project</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-400">Category</th>
                          <th className="text-right px-4 py-3 font-semibold text-slate-400">Manual Cost</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-400">Build Status</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-400">Health</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-400">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1a2b4a]">
                        {filteredArchived.map((p) => (
                          <tr key={p.projectName} className="hover:bg-[#0a1628]/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 flex items-center justify-center rounded-md bg-[#0a1628] text-slate-600">
                                  <i className="ri-archive-line text-[11px]"></i>
                                </div>
                                <span className="text-slate-400 font-medium text-[11px]">{p.projectName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-medium text-slate-500 bg-[#0a1628] px-2 py-0.5 rounded-full whitespace-nowrap capitalize">{p.category}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-slate-500 text-[11px] font-mono">{formatCurrency(p.manualCost || p.automatedCost)}</span>
                            </td>
                            <td className="px-4 py-3">
                              {getBuildStatusBadge(p.manualBuildStatus) || <span className="text-slate-600 text-[10px]">{'\u2014'}</span>}
                            </td>
                            <td className="px-4 py-3">
                              {getHealthBadge(p.manualHealth) || <span className="text-slate-600 text-[10px]">{'\u2014'}</span>}
                            </td>
                            <td className="px-4 py-3">
                              {p.metricUpdatedAt ? (
                                <span className="text-slate-500 text-[10px] font-mono">
                                  {new Date(p.metricUpdatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-[10px]">{'\u2014'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#111d35] rounded-2xl border border-[#1a2b4a] p-6">
              <p className="text-[11px] text-slate-600 text-center space-x-4">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-1"></span>
                  Automated data from platform_costs (never overwritten)
                </span>
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1"></span>
                  Manual overrides from project_metrics
                </span>
                {!isSuperAdmin && (
                  <span className="text-amber-400">Only super-admins can edit manual metrics</span>
                )}
              </p>
            </div>
          </>
        )}
      </main>

      {editProject && (
        <ProjectEditModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={handleSaved}
          isSuperAdmin={isSuperAdmin}
          showToast={showToast}
        />
      )}

      {taskProject && (
        <TaskDrawer
          projectName={taskProject}
          onClose={() => { setTaskProject(null); fetchTaskCounts(projects.map((p) => p.projectName)); }}
          isSuperAdmin={isSuperAdmin}
          showToast={showToast}
        />
      )}

      {deploymentProject && (
        <DeploymentDetailModal
          projectName={deploymentProject}
          deployment={deployments[deploymentProject.toLowerCase()] || null}
          onClose={() => setDeploymentProject(null)}
          onSaved={fetchData}
          isSuperAdmin={isSuperAdmin}
          showToast={showToast}
        />
      )}

      {backupProject && (
        <BackupDetailModal
          projectName={backupProject}
          backup={backups[backupProject.toLowerCase()] || null}
          onClose={() => setBackupProject(null)}
          onSaved={fetchData}
          isSuperAdmin={isSuperAdmin}
          showToast={showToast}
        />
      )}
    </div>
  );
}