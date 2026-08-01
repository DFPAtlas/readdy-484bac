'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import ClientDetailModal from './ClientDetailModal';
import DeleteUserModal from '@/components/admin/DeleteUserModal';

interface Client {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  company_type: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  verified: boolean | null;
  profile_completed: boolean | null;
  total_jobs_posted: number | null;
  active_jobs: number | null;
  total_spent: number | null;
  created_at: string | null;
  last_login: string | null;
  notes: string | null;
  is_suspended?: boolean | null;
}

interface ClientsTableProps {
  clients: Client[];
  searchQuery: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdate?: () => void;
}

export default function ClientsTable({ clients, searchQuery, selectedIds, onSelectionChange, onUpdate }: ClientsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
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
  }, [searchQuery, clients]);

  const filtered = clients.filter(c => {
    const q = searchQuery.toLowerCase();
    const name = c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : c.contact_name;
    return (
      name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      ''
    );
  });

  const totalItems = filtered.length;
  const paginatedClients = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paginatedIds = paginatedClients.map(c => c.id);
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

  const getProfilePercent = (client: Client): number => {
    const fields = [
      !!client.first_name?.trim(),
      !!client.last_name?.trim(),
      !!client.company_name?.trim(),
      !!client.phone?.trim(),
      !!client.email?.trim(),
      !!client.city?.trim(),
      !!client.postcode?.trim(),
      !!client.address?.trim(),
      !!client.company_type?.trim(),
      !!client.industry?.trim(),
      !!client.company_size?.trim(),
      !!client.website?.trim(),
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
            <i className="ri-building-line text-3xl text-slate-600"></i>
          </div>
        </div>
        <p className="text-slate-400 font-medium">No clients found</p>
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
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Client</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Company</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Contact</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Location</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Jobs</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Profile</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Joined</th>
              {isSuperAdmin && (
                <th className="text-left px-3 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-12"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2b4a]">
            {paginatedClients.map((client) => {
              const displayName = client.first_name && client.last_name
                ? `${client.first_name} ${client.last_name}`
                : client.contact_name;
              const initials = displayName
                ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                : '?';
              const isSelected = selectedIds.includes(client.id);
              const profilePct = getProfilePercent(client);

              return (
                <tr 
                  key={client.id} 
                  className={`hover:bg-[#0a1628] transition-colors cursor-pointer ${isSelected ? 'bg-teal-500/10' : ''}`}
                  onClick={() => setSelectedClient(client)}
                >
                  <td className="w-12 px-3 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => handleSelectRow(client.id, e)}
                        className="w-4 h-4 rounded border-slate-600 text-teal-600 focus:ring-teal-500 cursor-pointer bg-transparent"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-teal-500 to-sky-600 rounded-full text-white font-semibold text-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white text-sm truncate">{displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-sm text-white truncate max-w-[160px]">{client.company_name || '-'}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[160px]">{client.industry || client.company_type || '-'}</p>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-sm text-slate-300 whitespace-nowrap">{client.phone || '-'}</p>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <p className="text-sm text-slate-300 whitespace-nowrap">{client.city || '-'}</p>
                    <p className="text-xs text-slate-500">{client.postcode || ''}</p>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">{client.total_jobs_posted || 0}</p>
                        <p className="text-xs text-slate-400">Posted</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-teal-400">{client.active_jobs || 0}</p>
                        <p className="text-xs text-slate-400">Active</p>
                      </div>
                    </div>
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
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      {client.is_suspended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300 ring-1 ring-red-500/20 w-fit whitespace-nowrap">
                          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-forbid-line text-xs"></i></div>
                          Suspended
                        </span>
                      ) : client.verified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20 w-fit whitespace-nowrap">
                          <div className="w-3 h-3 flex items-center justify-center"><i className="ri-checkbox-circle-fill text-xs"></i></div>
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20 w-fit whitespace-nowrap">
                          Unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400 whitespace-nowrap hidden md:table-cell">
                    {client.created_at
                      ? new Date(client.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-3 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget(client)}
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete client permanently"
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

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdate={onUpdate}
        />
      )}

      {deleteTarget && isSuperAdmin && (
        <DeleteUserModal
          userId={deleteTarget.id}
          userName={deleteTarget.first_name && deleteTarget.last_name ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : deleteTarget.contact_name}
          userEmail={deleteTarget.email}
          userType="client"
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
