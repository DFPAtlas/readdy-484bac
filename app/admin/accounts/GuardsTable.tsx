'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import GuardDetailModal from './GuardDetailModal';
import DeleteUserModal from '@/components/admin/DeleteUserModal';

interface Guard {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  sia_licence_number: string | null;
  sia_license_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean | null;
  verification_status: string;
  is_active: boolean | null;
  years_experience: number | null;
  hourly_rate: number | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  completed_jobs: number | null;
  total_earnings: number | null;
  specializations: string[] | null;
  certifications: string[] | null;
  profile_completed: boolean | null;
  bio: string | null;
  availability: string | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  bank_status?: 'verified' | 'pending' | 'missing';
}

interface GuardsTableProps {
  guards: Guard[];
  searchQuery: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdate?: () => void;
}

export default function GuardsTable({ guards, searchQuery, selectedIds, onSelectionChange, onUpdate }: GuardsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Guard | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function checkSuperAdmin() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('admin_users').select('role').eq('user_id', session.user.id).maybeSingle();
      if (data && data.role === 'super_admin') setIsSuperAdmin(true);
    }
    checkSuperAdmin();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, guards]);

  const filtered = guards.filter(g => {
    const q = searchQuery.toLowerCase();
    const name = g.first_name && g.last_name ? `${g.first_name} ${g.last_name}` : g.full_name;
    return (
      name?.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.city?.toLowerCase().includes(q) ||
      g.sia_licence_number?.toLowerCase().includes(q) ||
      g.sia_license_number?.toLowerCase().includes(q) ||
      ''
    );
  });

  const totalItems = filtered.length;
  const paginatedGuards = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paginatedIds = paginatedGuards.map(g => g.id);
  const allPageSelected = paginatedIds.length > 0 && paginatedIds.every(id => selectedIds.includes(id));
  const somePageSelected = paginatedIds.some(id => selectedIds.includes(id)) && !allPageSelected;

  const handleSelectAll = () => {
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter(id => !paginatedIds.includes(id)));
    } else {
      const newSelection = [...new Set([...selectedIds, ...paginatedIds])];
      onSelectionChange(newSelection);
    }
  };

  const handleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getStatusBadge = (status: string, isActive: boolean | null) => {
    if (status === 'approved' && isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-checkbox-circle-fill text-xs"></i></div>
          Active
        </span>
      );
    }
    if (status === 'approved' && !isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20">
          Inactive
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-time-line text-xs"></i></div>
          Pending
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/20">
          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-circle-fill text-xs"></i></div>
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20">
        {status}
      </span>
    );
  };

  const getProfilePercent = (guard: Guard): number => {
    const fields = [
      !!guard.full_name?.trim(),
      !!guard.phone?.trim(),
      !!guard.city?.trim(),
      !!(guard.sia_licence_number || guard.sia_license_number)?.trim(),
      !!guard.sia_expiry_date,
      guard.years_experience != null && guard.years_experience > 0,
      !!guard.hourly_rate && guard.hourly_rate > 0,
      !!guard.bio?.trim(),
      !!guard.date_of_birth,
      !!guard.emergency_contact_name?.trim(),
      !!guard.emergency_contact_phone?.trim(),
      !!guard.certifications && guard.certifications.length > 0,
      guard.bank_status === 'verified',
    ];
    const done = fields.filter(Boolean).length;
    return Math.round((done / fields.length) * 100);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 flex items-center justify-center bg-[#0a1628] rounded-2xl mx-auto mb-4 ring-1 ring-[#1a2b4a]">
          <div className="w-8 h-8 flex items-center justify-center">
            <i className="ri-shield-user-line text-3xl text-slate-600"></i>
          </div>
        </div>
        <p className="text-slate-400 font-medium">No guards found</p>
        <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full table-fixed">
          <thead className="bg-[#0a1628] border-b border-[#1a2b4a]">
            <tr>
              <th className="w-12 px-3 py-4">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer bg-transparent"
                  />
                </div>
              </th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Guard</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Contact</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Location</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">SIA Licence</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Bank</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Profile</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Perf.</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Joined</th>
              {isSuperAdmin && (
                <th className="text-left px-3 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {paginatedGuards.map((guard) => {
              const displayName = guard.first_name && guard.last_name
                ? `${guard.first_name} ${guard.last_name}`
                : guard.full_name;
              const initials = displayName
                ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : '?';
              const siaNumber = guard.sia_license_number || guard.sia_licence_number;
              const jobsDone = guard.total_jobs_completed || guard.completed_jobs || 0;
              const isSelected = selectedIds.includes(guard.id);
              const profilePct = getProfilePercent(guard);

              return (
                <tr 
                  key={guard.id} 
                  className={`hover:bg-[#0a1628] transition-colors cursor-pointer ${isSelected ? 'bg-teal-500/10' : ''}`}
                  onClick={() => setSelectedGuard(guard)}
                >
                  <td className="w-12 px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => handleSelectRow(guard.id, e)}
                        className="w-4 h-4 rounded border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer bg-transparent"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div title={displayName} className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full text-white font-semibold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{guard.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-sm text-slate-300 whitespace-nowrap">{guard.phone || '-'}</p>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-sm text-slate-300 whitespace-nowrap">{guard.city || '-'}</p>
                    <p className="text-xs text-slate-500">{guard.postcode || ''}</p>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div>
                      <p className="text-sm text-white font-mono whitespace-nowrap">{siaNumber || '-'}</p>
                      {guard.sia_verified ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium whitespace-nowrap">
                          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-verified-badge-fill text-xs"></i></div>
                          Verified
                        </span>
                      ) : siaNumber ? (
                        <span className="text-xs text-amber-400 font-medium whitespace-nowrap">Unverified</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    {guard.bank_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 whitespace-nowrap">
                        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-bank-card-fill text-xs"></i></div>
                        Verified
                      </span>
                    )}
                    {guard.bank_status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20 whitespace-nowrap">
                        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-time-line text-xs"></i></div>
                        Pending
                      </span>
                    )}
                    {(!guard.bank_status || guard.bank_status === 'missing') && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20 whitespace-nowrap">
                        <div className="w-3 h-3 flex items-center justify-center"><i className="ri-close-line text-xs"></i></div>
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden xl:table-cell">
                    <div className="w-24">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-400">{profilePct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1a2b4a] rounded-full overflow-hidden">
                        <div className={`h-full ${getProgressColor(profilePct)} rounded-full transition-all`} style={{ width: `${profilePct}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-4">
                      {guard.rating ? (
                        <div className="text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <div className="w-4 h-4 flex items-center justify-center"><i className="ri-star-fill text-amber-400 text-xs"></i></div>
                            <span className="text-sm font-semibold text-white">{Number(guard.rating).toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-slate-400 whitespace-nowrap">{guard.total_reviews || 0} reviews</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-slate-500 whitespace-nowrap">No rating</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">{jobsDone}</p>
                        <p className="text-xs text-slate-400">Jobs</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(guard.verification_status, guard.is_active)}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {guard.created_at
                      ? new Date(guard.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-3 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget(guard)}
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete guard permanently"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(count) => {
          setItemsPerPage(count);
          setCurrentPage(1);
        }}
      />

      {selectedGuard && (
        <GuardDetailModal
          guard={selectedGuard}
          onClose={() => setSelectedGuard(null)}
          onUpdate={onUpdate}
        />
      )}

      {deleteTarget && isSuperAdmin && (
        <DeleteUserModal
          userId={deleteTarget.id}
          userName={deleteTarget.first_name && deleteTarget.last_name ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : deleteTarget.full_name}
          userEmail={deleteTarget.email}
          userType="guard"
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            onUpdate?.();
          }}
        />
      )}
    </div>
  );
}
