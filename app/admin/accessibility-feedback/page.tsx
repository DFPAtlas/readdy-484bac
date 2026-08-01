'use client';


import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Feedback {
  id: string;
  ticket_id: string;
  name: string;
  email: string;
  assistive_technology: string;
  issue_type: string;
  severity: string;
  page_url: string;
  browser_device: string;
  description: string;
  status: string;
  admin_notes: string;
  resolved_by: string;
  resolved_at: string;
  created_at: string;
}

export default function AccessibilityFeedbackAdmin() {
  // ---------- State ----------
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  // ---------- Effects ----------
  useEffect(() => {
    fetchFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Data fetching ----------
  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('accessibility_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbacks(data ?? []);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      setMessage('Failed to load feedback reports.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- CSV Export ----------
  const exportToCSV = () => {
    setExporting(true);
    try {
      const dataToExport = filteredFeedbacks.length > 0 ? filteredFeedbacks : feedbacks;
      
      const headers = [
        'Ticket ID',
        'Status',
        'Severity',
        'Issue Type',
        'Reporter Name',
        'Reporter Email',
        'Assistive Technology',
        'Page URL',
        'Browser/Device',
        'Description',
        'Admin Notes',
        'Created At',
        'Resolved At'
      ];

      const csvRows = [
        headers.join(','),
        ...dataToExport.map(feedback => {
          const row = [
            feedback.ticket_id || '',
            feedback.status || '',
            feedback.severity || '',
            feedback.issue_type || '',
            feedback.name || '',
            feedback.email || '',
            feedback.assistive_technology || '',
            feedback.page_url || '',
            feedback.browser_device || '',
            (feedback.description || '').replace(/"/g, '""'),
            (feedback.admin_notes || '').replace(/"/g, '""'),
            feedback.created_at ? new Date(feedback.created_at).toLocaleString('en-GB') : '',
            feedback.resolved_at ? new Date(feedback.resolved_at).toLocaleString('en-GB') : ''
          ];
          return row.map(field => `"${field}"`).join(',');
        })
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `accessibility-feedback-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage('CSV exported successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setMessage('Error exporting CSV');
    } finally {
      setExporting(false);
    }
  };

  // ---------- Helpers ----------
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // ---------- Mutations ----------
  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'resolved') {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        updates.resolved_by = authData.user?.id ?? null;
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('accessibility_feedback')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setMessage('Status updated successfully');
      await fetchFeedbacks();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      setMessage('Error updating status');
    } finally {
      setUpdating(false);
    }
  };

  const saveAdminNotes = async (id: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('accessibility_feedback')
        .update({
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setMessage('Notes saved successfully');
      await fetchFeedbacks();
      setSelectedFeedback(null);
      setAdminNotes('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error saving notes:', err);
      setMessage('Error saving notes');
    } finally {
      setUpdating(false);
    }
  };

  // ---------- Derived data ----------
  const filteredFeedbacks = feedbacks.filter((f) => {
    const statusMatch = filter === 'all' || f.status === filter;
    const severityMatch = severityFilter === 'all' || f.severity === severityFilter;
    const searchMatch = searchQuery === '' || 
      (f.ticket_id && f.ticket_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.name && f.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.email && f.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return statusMatch && severityMatch && searchMatch;
  });

  const stats = {
    total: feedbacks.length,
    new: feedbacks.filter((f) => f.status === 'new').length,
    inProgress: feedbacks.filter((f) => f.status === 'in_progress').length,
    resolved: feedbacks.filter((f) => f.status === 'resolved').length,
    critical: feedbacks.filter((f) => f.severity === 'critical').length,
    high: feedbacks.filter((f) => f.severity === 'high').length,
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      {/* Header */}
      <div className="bg-[#111d35] border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Accessibility Feedback</h1>
              <p className="text-slate-400 mt-1">Manage and respond to accessibility reports</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={exporting || feedbacks.length === 0}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line mr-2"></i>
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <Link
                href="/admin/dashboard"
                className="px-4 py-2 bg-[#1a2b4a] text-slate-400 rounded-lg hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-2"></i>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global message */}
        {message && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#111d35] p-6 rounded-xl border border-[#1a2b4a]">
            <div className="text-3xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-slate-400 mt-1">Total Reports</div>
          </div>
          <div className="bg-purple-500/10 p-6 rounded-xl border border-purple-500/20">
            <div className="text-3xl font-bold text-purple-400">{stats.new}</div>
            <div className="text-sm text-purple-300 mt-1">New</div>
          </div>
          <div className="bg-blue-500/10 p-6 rounded-xl border border-blue-500/20">
            <div className="text-3xl font-bold text-blue-400">{stats.inProgress}</div>
            <div className="text-sm text-blue-300 mt-1">In Progress</div>
          </div>
          <div className="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/20">
            <div className="text-3xl font-bold text-emerald-400">{stats.resolved}</div>
            <div className="text-sm text-emerald-300 mt-1">Resolved</div>
          </div>
          <div className="bg-red-500/10 p-6 rounded-xl border border-red-500/20">
            <div className="text-3xl font-bold text-red-400">{stats.critical}</div>
            <div className="text-sm text-red-300 mt-1">Critical</div>
          </div>
          <div className="bg-orange-500/10 p-6 rounded-xl border border-orange-500/20">
            <div className="text-3xl font-bold text-orange-400">{stats.high}</div>
            <div className="text-sm text-orange-300 mt-1">High Priority</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-slate-400 mb-2">Search by Ticket ID, Name or Email</label>
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. ACC-M5K2P9Q1-A7B3"
                  className="w-full pl-10 pr-4 py-2 border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-[#0a1628] text-white placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Status Filter</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#0a1628] text-white text-sm cursor-pointer pr-8"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Severity Filter</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#0a1628] text-white text-sm cursor-pointer pr-8"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback list */}
        <div className="space-y-4">
          {filteredFeedbacks.length === 0 ? (
            <div className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-12 text-center">
              <div className="w-16 h-16 bg-[#1a2b4a] rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-inbox-line text-3xl text-slate-500"></i>
              </div>
              <p className="text-slate-400">No feedback reports found</p>
            </div>
          ) : (
            filteredFeedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className="bg-[#111d35] rounded-xl border border-[#1a2b4a] p-6 hover:border-teal-500/30 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {feedback.ticket_id && (
                        <span className="px-3 py-1 rounded-lg bg-[#0a1628] text-teal-400 text-xs font-mono font-medium">
                          {feedback.ticket_id}
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(
                          feedback.severity
                        )}`}
                      >
                        {feedback.severity.toUpperCase()}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          feedback.status
                        )}`}
                      >
                        {feedback.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feedback.issue_type}</h3>
                    <p className="text-sm text-slate-400">
                      Reported by {feedback.name} ({feedback.email})
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <time dateTime={feedback.created_at}>
                      {new Date(feedback.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                  {feedback.assistive_technology && (
                    <div>
                      <span className="font-medium text-slate-400">Assistive Technology:</span>
                      <span className="text-slate-300 ml-2">{feedback.assistive_technology}</span>
                    </div>
                  )}
                  {feedback.page_url && (
                    <div>
                      <span className="font-medium text-slate-400">Page URL:</span>
                      <a
                        href={feedback.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300 ml-2"
                      >
                        {feedback.page_url}
                      </a>
                    </div>
                  )}
                  {feedback.browser_device && (
                    <div>
                      <span className="font-medium text-slate-400">Browser/Device:</span>
                      <span className="text-slate-300 ml-2">{feedback.browser_device}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="bg-[#0a1628] rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-slate-400 mb-2">Description:</p>
                  <p className="text-slate-300">{feedback.description}</p>
                </div>

                {/* Admin notes (display) */}
                {feedback.admin_notes && (
                  <div className="bg-blue-500/10 rounded-lg p-4 mb-4 border border-blue-500/20">
                    <p className="text-sm font-medium text-blue-400 mb-2">Admin Notes:</p>
                    <p className="text-blue-300">{feedback.admin_notes}</p>
                  </div>
                )}

                {/* Admin notes (edit) */}
                {selectedFeedback?.id === feedback.id ? (
                  <div className="mt-4 p-4 bg-[#0a1628] rounded-lg">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-[#1a2b4a] rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-[#111d35] text-white text-sm"
                      placeholder="Add notes about this issue..."
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => saveAdminNotes(feedback.id)}
                        disabled={updating}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {updating ? 'Saving...' : 'Save Notes'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedFeedback(null);
                          setAdminNotes('');
                        }}
                        className="px-4 py-2 bg-[#1a2b4a] text-slate-400 rounded-lg hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {feedback.status !== 'in_progress' && (
                      <button
                        onClick={() => updateStatus(feedback.id, 'in_progress')}
                        disabled={updating}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        <i className="ri-play-line mr-2"></i>
                        Mark In Progress
                      </button>
                    )}
                    {feedback.status !== 'resolved' && (
                      <button
                        onClick={() => updateStatus(feedback.id, 'resolved')}
                        disabled={updating}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        <i className="ri-check-line mr-2"></i>
                        Mark Resolved
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedFeedback(feedback);
                        setAdminNotes(feedback.admin_notes || '');
                      }}
                      className="px-4 py-2 bg-[#1a2b4a] text-slate-400 rounded-lg hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap"
                    >
                      <i className="ri-edit-line mr-2"></i>
                      {feedback.admin_notes ? 'Edit Notes' : 'Add Notes'}
                    </button>
                    <a
                      href={`mailto:${feedback.email}?subject=Re: Accessibility Feedback ${feedback.ticket_id ? `[${feedback.ticket_id}]` : ''} - ${feedback.issue_type}`}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition whitespace-nowrap"
                    >
                      <i className="ri-mail-line mr-2"></i>
                      Email Reporter
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
