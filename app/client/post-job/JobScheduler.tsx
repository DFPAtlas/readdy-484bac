'use client';

interface JobSchedulerProps {
  publishAt: string;
  expiresAt: string;
  autoCloseOnExpiry: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

export default function JobScheduler({ publishAt, expiresAt, autoCloseOnExpiry, onChange }: JobSchedulerProps) {
  const isScheduled = !!publishAt && new Date(publishAt) > new Date();

  return (
    <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center border border-blue-500/25">
          <i className="ri-calendar-schedule-line text-blue-400 text-lg"></i>
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Schedule & Expiry</h3>
          <p className="text-xs text-slate-500">Control when your job goes live and when it closes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            <i className="ri-calendar-2-line mr-1 text-blue-400"></i>
            Publish Date & Time
          </label>
          <input
            type="datetime-local"
            name="publishAt"
            value={publishAt}
            onChange={onChange}
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white text-sm"
          />
          {isScheduled ? (
            <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
              <i className="ri-time-line"></i>
              Will publish as draft — goes live at scheduled time
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">Leave blank to publish immediately</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">
            <i className="ri-timer-flash-line mr-1 text-amber-400"></i>
            Expiry Date & Time
          </label>
          <input
            type="datetime-local"
            name="expiresAt"
            value={expiresAt}
            onChange={onChange}
            className="w-full px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Leave blank for no expiry</p>
        </div>
      </div>

      {expiresAt && (
        <div className="mt-4 flex items-center gap-3 p-3 bg-[#162036] rounded-xl border border-[#1e2d4d]">
          <button
            type="button"
            onClick={() => onChange({ target: { name: 'autoCloseOnExpiry', value: String(!autoCloseOnExpiry) } } as any)}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${autoCloseOnExpiry ? 'bg-amber-500' : 'bg-[#111d35] border border-[#1e2d4d]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoCloseOnExpiry ? 'translate-x-4' : 'translate-x-0.5'}`}></span>
          </button>
          <div>
            <p className="text-sm font-semibold text-white">Auto-close on expiry</p>
            <p className="text-xs text-slate-500">Job will automatically change to closed status at expiry time</p>
          </div>
        </div>
      )}

      {isScheduled && (
        <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-3">
          <i className="ri-information-line text-blue-400 mt-0.5 flex-shrink-0"></i>
          <p className="text-sm text-blue-300">
            This job will be saved as a <span className="font-semibold">Draft</span> and automatically published at{' '}
            <span className="font-semibold">{new Date(publishAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>.
          </p>
        </div>
      )}
    </div>
  );
}