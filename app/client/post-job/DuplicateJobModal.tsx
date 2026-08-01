
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PreviousJob {
  id: string;
  job_title: string;
  security_type: string;
  venue_name: string;
  venue_city: string;
  hourly_rate: number;
  start_date: string;
  status: string;
}

interface DuplicateJobModalProps {
  clientId: string;
  onSelectJob: (job: any) => void;
  onClose: () => void;
}

export default function DuplicateJobModal({ clientId, onSelectJob, onClose }: DuplicateJobModalProps) {
  const [jobs, setJobs] = useState<PreviousJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPreviousJobs();
  }, []);

  const loadPreviousJobs = async () => {
    try {
      const { data } = await supabase
        .from('jobs')
        .select('id, job_title, security_type, venue_name, venue_city, hourly_rate, start_date, status')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);

      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFullJob = async (jobId: string) => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (data) {
      onSelectJob(data);
    }
  };

  const filtered = jobs.filter(j =>
    j.job_title.toLowerCase().includes(search.toLowerCase()) ||
    j.venue_name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Duplicate Previous Job</h2>
            <p className="text-sm text-gray-500 mt-1">Select a job to copy its details</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search previous jobs..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-[55vh] p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-briefcase-line text-3xl text-gray-400"></i>
              </div>
              <p className="text-gray-600 font-medium">No previous jobs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((job) => (
                <button
                  key={job.id}
                  onClick={() => loadFullJob(job.id)}
                  className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{job.job_title}</h3>
                    <span className={`${getStatusColor(job.status)} px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ml-2`}>
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <i className="ri-map-pin-line"></i>
                      {job.venue_name}, {job.venue_city}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-money-pound-circle-line"></i>
                      £{job.hourly_rate}/hr
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      {new Date(job.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
