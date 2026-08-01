'use client';

import { useEffect, useState } from 'react';
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
  job_count?: number;
  last_job_date?: string;
}

interface SiteDetailDrawerProps {
  site: SavedSite | null;
  onClose: () => void;
  onEdit: (site: SavedSite) => void;
  onUse: (site: SavedSite) => void;
  onDuplicate: (site: SavedSite) => void;
  onArchive: (site: SavedSite) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<string, { label: string; colour: string; bg: string; border: string }> = {
  active: { label: 'Active', colour: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  inactive: { label: 'Inactive', colour: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  needs_info: { label: 'Needs Info', colour: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#1e2d4d] pt-5">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <i className={`${icon} text-slate-500`}></i>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  );
}

export default function SiteDetailDrawer({ site, onClose, onEdit, onUse, onDuplicate, onArchive, onDelete }: SiteDetailDrawerProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [site?.id]);

  const handleClose = () => {
    setConfirmingDelete(false);
    onClose();
  };

  if (!site) return null;
  const status = statusConfig[site.status || 'active'] || statusConfig.active;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose}></div>
      <div className="relative bg-[#111d35] w-full max-w-lg h-full overflow-y-auto border-l border-[#1e2d4d] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#111d35] z-10 p-6 border-b border-[#1e2d4d]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/25">
                <i className="ri-building-line text-teal-400 text-xl"></i>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{site.site_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.colour} ${status.border}`}>
                  {status.label}
                </span>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white cursor-pointer">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
          <p className="text-sm text-slate-400">{site.address_line1}{site.address_line2 ? `, ${site.address_line2}` : ''}, {site.city} {site.postcode}</p>

          <div className="flex items-center gap-3 mt-4">
            <Link
              href={`/client/post-job?site=${site.id}`}
              className="flex-1 bg-teal-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-teal-600 transition-colors text-center cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
            >
              <i className="ri-add-line"></i>Post Job Here
            </Link>
            <button onClick={() => onUse(site)} className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#162036] rounded-xl p-3 border border-[#1e2d4d]">
              <p className="text-xs text-slate-500">Jobs posted</p>
              <p className="text-xl font-bold text-white">{site.job_count ?? 0}</p>
            </div>
            <div className="bg-[#162036] rounded-xl p-3 border border-[#1e2d4d]">
              <p className="text-xs text-slate-500">Last job</p>
              <p className="text-sm font-bold text-white">
                {site.last_job_date
                  ? new Date(site.last_job_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'None'}
              </p>
            </div>
          </div>

          <Section title="Site Contact" icon="ri-user-line">
            <Field label="Name" value={site.site_contact_name} />
            <Field label="Phone" value={site.site_contact_phone} />
            <Field label="Email" value={site.site_contact_email} />
            {!site.site_contact_name && !site.site_contact_phone && !site.site_contact_email && (
              <p className="text-sm text-slate-500 italic">No site contact added</p>
            )}
          </Section>

          <Section title="Emergency Contact" icon="ri-phone-line">
            <Field label="Name" value={site.emergency_contact_name} />
            <Field label="Phone" value={site.emergency_contact_phone} />
            {!site.emergency_contact_name && !site.emergency_contact_phone && (
              <p className="text-sm text-slate-500 italic">No emergency contact added</p>
            )}
          </Section>

          <Section title="Access & Entry" icon="ri-door-open-line">
            <Field label="Access Instructions" value={site.access_instructions} />
            <Field label="Key / Entry Instructions" value={site.key_entry_instructions} />
            <Field label="Parking Details" value={site.parking_details} />
            {!site.access_instructions && !site.key_entry_instructions && !site.parking_details && (
              <p className="text-sm text-slate-500 italic">No access details added</p>
            )}
          </Section>

          <Section title="Guard Instructions" icon="ri-shield-check-line">
            <Field label="Patrol Expectations" value={site.patrol_expectations} />
            <Field label="Uniform Requirements" value={site.uniform_requirements} />
            <Field label="CCTV / Control Room" value={site.cctv_details} />
            {!site.patrol_expectations && !site.uniform_requirements && !site.cctv_details && (
              <p className="text-sm text-slate-500 italic">No guard instructions added</p>
            )}
          </Section>

          <Section title="Risk & Safety" icon="ri-alert-line">
            <Field label="Risk Notes" value={site.risk_notes} />
            {!site.risk_notes && (
              <p className="text-sm text-slate-500 italic">No risk notes added</p>
            )}
          </Section>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-[#111d35] border-t border-[#1e2d4d] p-4">
          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-300 truncate">
                Delete <span className="font-semibold text-white">{site.site_name}</span>?
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2.5 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onDelete(site.id); setConfirmingDelete(false); }}
                  className="px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(site)}
                className="flex-1 bg-[#162036] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-edit-line"></i>Edit Site
              </button>
              <button
                onClick={() => onDuplicate(site)}
                className="px-4 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-copy-line"></i>
              </button>
              <button
                onClick={() => onArchive(site)}
                className="px-4 py-3 border border-[#1e2d4d] text-slate-300 rounded-xl text-sm font-semibold hover:bg-[#162036] transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-archive-line"></i>
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="px-4 py-3 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}