'use client';

interface Job {
  id: string;
  job_title: string;
  venue_name: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
}

interface JobSummaryCardProps {
  job: Job;
  hours: number;
}

export default function JobSummaryCard({ job, hours }: JobSummaryCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden">
      <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 p-6 border-b border-[#1e2d4d]">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-teal-400 text-sm font-medium">Job Reference</span>
            <h2 className="text-2xl font-bold text-white mt-1">{job.job_title}</h2>
          </div>
          <div className="text-right">
            <span className="text-teal-400 text-sm">Total Hours</span>
            <p className="text-3xl font-bold text-white">{hours.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Location</h4>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-map-pin-line text-teal-400 text-xl"></i>
              </div>
              <div>
                <p className="font-semibold text-slate-200">{job.venue_name}</p>
                <p className="text-sm text-slate-500">{job.venue_city}</p>
                <p className="text-sm text-slate-500">{job.venue_postcode}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Schedule</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-calendar-line text-emerald-400 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="font-semibold text-slate-200">
                    {formatDate(job.start_date)}
                    {job.end_date && job.end_date !== job.start_date && (
                      <span> - {formatDate(job.end_date)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-violet-400 text-xl"></i>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Time</p>
                  <p className="font-semibold text-slate-200">
                    {formatTime(job.start_time)} - {formatTime(job.end_time)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#1e2d4d]">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-teal-400">{job.number_of_guards}</p>
              <p className="text-sm text-slate-500">Guards Assigned</p>
            </div>
            <div className="text-center p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-teal-400">£{job.hourly_rate}</p>
              <p className="text-sm text-slate-500">Per Hour</p>
            </div>
            <div className="text-center p-4 bg-[#162036] rounded-xl border border-[#1e2d4d]">
              <p className="text-2xl font-bold text-teal-400">{hours.toFixed(1)}h</p>
              <p className="text-sm text-slate-500">Total Hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
