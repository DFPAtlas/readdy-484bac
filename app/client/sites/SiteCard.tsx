import Link from 'next/link';

interface SavedSite {
  id: string;
  site_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  site_contact_email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  access_instructions?: string;
  parking_details?: string;
  risk_notes?: string;
  key_entry_instructions?: string;
  patrol_expectations?: string;
  uniform_requirements?: string;
  cctv_details?: string;
  status?: string;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
  job_count?: number;
  last_job_date?: string;
}

interface SiteCardProps {
  site: SavedSite;
  onView: (site: SavedSite) => void;
  onEdit: (site: SavedSite) => void;
  onDelete: (id: string) => void;
  onDuplicate: (site: SavedSite) => void;
  onArchive: (site: SavedSite) => void;
  onUse: (site: SavedSite) => void;
  confirmDelete: string | null;
  setConfirmDelete: (id: string | null) => void;
  viewMode?: 'grid' | 'list';
}

const statusConfig: Record<string, { label: string; colour: string; bg: string; border: string }> = {
  active: { label: 'Active', colour: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  inactive: { label: 'Inactive', colour: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  needs_info: { label: 'Needs Info', colour: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

function getMissingFields(site: SavedSite): string[] {
  const missing: string[] = [];
  if (!site.address_line1 || !site.city || !site.postcode) missing.push('Address');
  if (!site.site_contact_name || !site.site_contact_phone) missing.push('Contact');
  if (!site.emergency_contact_name || !site.emergency_contact_phone) missing.push('Emergency');
  if (!site.access_instructions) missing.push('Access');
  if (!site.parking_details) missing.push('Parking');
  if (!site.risk_notes) missing.push('Risk');
  return missing;
}

export default function SiteCard({ site, onView, onEdit, onDelete, onDuplicate, onArchive, onUse, confirmDelete, setConfirmDelete, viewMode = 'grid' }: SiteCardProps) {
  const status = statusConfig[site.status || 'active'] || statusConfig.active;
  const missing = getMissingFields(site);
  const completeness = 6 - missing.length;

  return (
    <div className={`bg-[#111d35] rounded-2xl border border-[#1e2d4d] hover:border-teal-500/30 transition-all ${viewMode === 'list' ? 'p-4' : 'p-5'}`}>
      <div className={`flex ${viewMode === 'list' ? 'flex-row items-center gap-4' : 'items-start justify-between'} mb-3`}>
        <div className={`flex items-center gap-3 ${viewMode === 'list' ? 'flex-1' : ''}`}>
          <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/25 flex-shrink-0">
            <i className="ri-building-line text-teal-400 text-lg"></i>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-sm truncate">{site.site_name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.colour} ${status.border}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{site.address_line1}, {site.city} {site.postcode}</p>
          </div>
        </div>

        {viewMode === 'grid' && (
          <div className="flex items-center gap-1">
            {confirmDelete === site.id ? (
              <div className="flex items-center gap-2">
                <button onClick={() => { onDelete(site.id); setConfirmDelete(null); }} className="text-red-400 text-xs font-semibold hover:text-red-300 cursor-pointer whitespace-nowrap">Confirm</button>
                <button onClick={() => setConfirmDelete(null)} className="text-slate-500 text-xs font-semibold hover:text-slate-300 cursor-pointer whitespace-nowrap">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => onView(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
                  <i className="ri-eye-line text-sm"></i>
                </button>
                <button onClick={() => onEdit(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
                  <i className="ri-edit-line text-sm"></i>
                </button>
                <button onClick={() => onDuplicate(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
                  <i className="ri-file-copy-line text-sm"></i>
                </button>
                <button onClick={() => onArchive(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-amber-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
                  <i className="ri-archive-line text-sm"></i>
                </button>
                <button onClick={() => setConfirmDelete(site.id)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
                  <i className="ri-delete-bin-line text-sm"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Completeness bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Site completeness</span>
          <span className={`text-xs font-semibold ${completeness === 6 ? 'text-emerald-400' : completeness >= 4 ? 'text-amber-400' : 'text-red-400'}`}>
            {completeness}/6
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#162036] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completeness === 6 ? 'bg-emerald-500' : completeness >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${(completeness / 6) * 100}%` }}
          />
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-slate-500 mt-1">Missing: {missing.join(', ')}</p>
        )}
      </div>

      <div className={`space-y-1.5 mb-4 ${viewMode === 'list' ? 'hidden md:block' : ''}`}>
        {site.site_contact_name && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <i className="ri-user-line text-slate-600"></i>
            {site.site_contact_name} {site.site_contact_phone && `— ${site.site_contact_phone}`}
          </p>
        )}
        {site.emergency_contact_name && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <i className="ri-phone-line text-slate-600"></i>
            Emergency: {site.emergency_contact_name} {site.emergency_contact_phone && `— ${site.emergency_contact_phone}`}
          </p>
        )}
        {site.access_instructions && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <i className="ri-door-open-line text-slate-600"></i>
            {site.access_instructions.slice(0, 55)}{site.access_instructions.length > 55 ? '...' : ''}
          </p>
        )}
        {site.risk_notes && (
          <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
            <i className="ri-alert-line text-amber-500/60"></i>
            {site.risk_notes.slice(0, 55)}{site.risk_notes.length > 55 ? '...' : ''}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <i className="ri-briefcase-line"></i>
          {site.job_count ?? 0} job{site.job_count === 1 ? '' : 's'}
        </span>
        {site.last_job_date && (
          <span className="flex items-center gap-1">
            <i className="ri-calendar-line"></i>
            Last: {new Date(site.last_job_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className={`flex items-center gap-2 pt-3 border-t border-[#1e2d4d] ${viewMode === 'list' ? 'flex-row' : ''}`}>
        <Link
          href={`/client/post-job?site=${site.id}`}
          className={`bg-teal-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-teal-600 transition-colors text-center cursor-pointer whitespace-nowrap flex items-center justify-center gap-1 ${viewMode === 'list' ? 'px-4' : 'flex-1'}`}
        >
          <i className="ri-add-line"></i>Post Job Here
        </Link>
        <button
          onClick={() => onUse(site)}
          className="px-3 py-2 border border-[#1e2d4d] text-slate-300 rounded-xl text-xs font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
        >
          <i className="ri-arrow-right-line"></i>
          Use
        </button>
        {viewMode === 'list' && (
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => onView(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
              <i className="ri-eye-line text-sm"></i>
            </button>
            <button onClick={() => onEdit(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
              <i className="ri-edit-line text-sm"></i>
            </button>
            <button onClick={() => onDuplicate(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-teal-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
              <i className="ri-file-copy-line text-sm"></i>
            </button>
            <button onClick={() => onArchive(site)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-amber-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
              <i className="ri-archive-line text-sm"></i>
            </button>
            <button onClick={() => setConfirmDelete(site.id)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-[#162036]">
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}