'use client';


import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logAdminAction } from '@/lib/admin-logger';
import AccountsTabs from './AccountsTabs';
import ClientsTable from './ClientsTable';
import GuardsTable from './GuardsTable';
import ExportCSV from './ExportCSV';
import BulkActionsBar from './BulkActionsBar';
import BulkEmailModal from './BulkEmailModal';
import RecentActivityLog from './RecentActivityLog';

export default function AccountsPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'guards'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showBulkEmail, setShowBulkEmail] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchAccounts = async () => {
    try {
      const [clientsRes, guardsRes, bankRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('guards').select('*').order('created_at', { ascending: false }),
        supabase.from('guard_bank_details').select('guard_id, bank_verified'),
      ]);

      const bankMap: Record<string, { bank_verified: boolean }> = {};
      (bankRes.data || []).forEach((b: any) => {
        bankMap[b.guard_id] = { bank_verified: b.bank_verified };
      });

      const guardsWithBank = (guardsRes.data || []).map((g: any) => {
        const bank = bankMap[g.id];
        let bank_status: 'verified' | 'pending' | 'missing' = 'missing';
        if (bank) {
          bank_status = bank.bank_verified ? 'verified' : 'pending';
        }
        return { ...g, bank_status };
      });

      setClients(clientsRes.data || []);
      setGuards(guardsWithBank);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkClientAction = async (action: string) => {
    if (selectedClientIds.length === 0) return;
    setIsProcessingBulk(true);

    try {
      let updateData: any = {};
      switch (action) {
        case 'verify':
          updateData = { verified: true };
          break;
        case 'unverify':
          updateData = { verified: false };
          break;
        case 'suspend':
          updateData = { is_suspended: true };
          break;
        case 'reactivate':
          updateData = { is_suspended: false };
          break;
        default:
          return;
      }

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .in('id', selectedClientIds);

      if (error) throw error;

      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Bulk action "${action}" applied to ${selectedClientIds.length} client(s)`,
        targetType: 'client',
        targetName: `${selectedClientIds.length} clients`,
        metadata: { action, clientIds: selectedClientIds },
      });

      setToast({ message: `Successfully updated ${selectedClientIds.length} clients`, type: 'success' });
      setSelectedClientIds([]);
      await fetchAccounts();
    } catch (error) {
      console.error('Bulk action error:', error);
      setToast({ message: 'Failed to update clients', type: 'error' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleBulkGuardAction = async (action: string) => {
    if (selectedGuardIds.length === 0) return;
    setIsProcessingBulk(true);

    try {
      let updateData: any = {};
      switch (action) {
        case 'approve':
          updateData = { verification_status: 'approved', is_active: true };
          break;
        case 'reject':
          updateData = { verification_status: 'rejected', is_active: false };
          break;
        case 'suspend':
          updateData = { is_active: false };
          break;
        case 'reactivate':
          updateData = { is_active: true };
          break;
        case 'verify_sia':
          updateData = { sia_verified: true, verification_status: 'verified' };
          break;
        case 'unverify_sia':
          updateData = { sia_verified: false, verification_status: 'rejected' };
          break;
        default:
          return;
      }

      const { error } = await supabase
        .from('guards')
        .update(updateData)
        .in('id', selectedGuardIds);

      if (error) throw error;

      await logAdminAction({
        actionType: 'user_status_changed',
        actionDescription: `Bulk action "${action}" applied to ${selectedGuardIds.length} guard(s)`,
        targetType: 'guard',
        targetName: `${selectedGuardIds.length} guards`,
        metadata: { action, guardIds: selectedGuardIds },
      });

      setToast({ message: `Successfully updated ${selectedGuardIds.length} guards`, type: 'success' });
      setSelectedGuardIds([]);
      await fetchAccounts();
    } catch (error) {
      console.error('Bulk action error:', error);
      setToast({ message: 'Failed to update guards', type: 'error' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const getEmailRecipients = () => {
    if (activeTab === 'clients') {
      return selectedClientIds.map(id => {
        const client = clients.find(c => c.id === id);
        if (!client) return null;
        const name = client.first_name && client.last_name
          ? `${client.first_name} ${client.last_name}`
          : client.contact_name || 'Client';
        return { id: client.id, name, email: client.email };
      }).filter(Boolean) as { id: string; name: string; email: string }[];
    } else {
      return selectedGuardIds.map(id => {
        const guard = guards.find(g => g.id === id);
        if (!guard) return null;
        const name = guard.first_name && guard.last_name
          ? `${guard.first_name} ${guard.last_name}`
          : guard.full_name || 'Guard';
        return { id: guard.id, name, email: guard.email };
      }).filter(Boolean) as { id: string; name: string; email: string }[];
    }
  };

  const filteredGuards = statusFilter === 'all'
    ? guards
    : statusFilter === 'active'
    ? guards.filter(g => g.verification_status === 'approved' && g.is_active)
    : statusFilter === 'pending'
    ? guards.filter(g => g.verification_status === 'pending' || g.verification_status === 'manual_review' || g.verification_status === 'pending_sia_check')
    : statusFilter === 'rejected'
    ? guards.filter(g => g.verification_status === 'rejected')
    : statusFilter === 'inactive'
    ? guards.filter(g => !g.is_active && g.verification_status === 'approved')
    : statusFilter === 'profile_incomplete'
    ? guards.filter(g => !g.profile_completed)
    : guards;

  const filteredClients = statusFilter === 'all'
    ? clients
    : statusFilter === 'verified'
    ? clients.filter(c => c.verified)
    : statusFilter === 'unverified'
    ? clients.filter(c => !c.verified)
    : statusFilter === 'profile_complete'
    ? clients.filter(c => c.profile_completed)
    : statusFilter === 'profile_incomplete'
    ? clients.filter(c => !c.profile_completed)
    : clients;

  const verifiedClients = clients.filter(c => c.verified).length;
  const activeGuards = guards.filter(g => g.verification_status === 'approved' && g.is_active).length;
  const pendingGuards = guards.filter(g => g.verification_status === 'pending' || g.verification_status === 'manual_review' || g.verification_status === 'pending_sia_check').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-teal-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm font-medium">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#111d35]/80 backdrop-blur-md border-b border-[#1a2b4a]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-900/50">
                <i className="ri-group-line text-xl"></i>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Client &amp; Guard Management</h1>
                <p className="text-xs text-slate-400">View, manage and verify all client and guard accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ExportCSV
                activeTab={activeTab}
                clients={filteredClients}
                guards={filteredGuards}
              />
              <button
                onClick={fetchAccounts}
                className="flex items-center gap-2 px-4 py-2 border border-[#1a2b4a] rounded-xl text-sm font-medium text-slate-400 hover:bg-[#1a2b4a] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-refresh-line"></i>
                </div>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 hover:border-teal-500/30 transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
                <i className="ri-building-line text-xl text-teal-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Total Clients</span>
            </div>
            <p className="text-3xl font-bold text-white">{clients.length}</p>
            <p className="text-xs text-slate-500 mt-1">{verifiedClients} verified</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 hover:border-teal-500/30 transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <i className="ri-shield-user-line text-xl text-emerald-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Total Guards</span>
            </div>
            <p className="text-3xl font-bold text-white">{guards.length}</p>
            <p className="text-xs text-slate-500 mt-1">{activeGuards} active</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 hover:border-teal-500/30 transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <i className="ri-time-line text-xl text-amber-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Pending Guards</span>
            </div>
            <p className="text-3xl font-bold text-white">{pendingGuards}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting verification</p>
          </div>
          <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl p-5 hover:border-teal-500/30 transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20">
                <i className="ri-group-line text-xl text-sky-400"></i>
              </div>
              <span className="text-sm font-medium text-slate-400">Total Accounts</span>
            </div>
            <p className="text-3xl font-bold text-white">{clients.length + guards.length}</p>
            <p className="text-xs text-slate-500 mt-1">All registered users</p>
          </div>
        </div>

        {/* Tabs + Search + Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <AccountsTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              setStatusFilter('all');
              setSearchQuery('');
              setSelectedClientIds([]);
              setSelectedGuardIds([]);
            }}
            clientCount={activeTab === 'clients' ? filteredClients.length : clients.length}
            guardCount={activeTab === 'guards' ? filteredGuards.length : guards.length}
          />

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-500">
                <i className="ri-search-line"></i>
              </div>
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 py-2.5 border border-[#1a2b4a] rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent w-64 bg-[#111d35] text-white placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`px-4 py-2.5 border rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
                  statusFilter !== 'all'
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
                    : 'border-[#1a2b4a] text-slate-400 hover:bg-[#1a2b4a] hover:text-white bg-[#111d35]'
                }`}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-filter-3-line"></i>
                </div>
                Filter
                {statusFilter !== 'all' && (
                  <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                )}
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#111d35] rounded-xl shadow-lg border border-[#1a2b4a] py-2 z-10">
                  <button
                    onClick={() => { setStatusFilter('all'); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'all' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}
                  >
                    All
                    {statusFilter === 'all' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}
                  </button>
                  {activeTab === 'clients' ? (
                    <>
                      <button onClick={() => { setStatusFilter('verified'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'verified' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Verified{statusFilter === 'verified' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('unverified'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'unverified' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Unverified{statusFilter === 'unverified' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('profile_complete'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'profile_complete' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Profile Complete{statusFilter === 'profile_complete' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('profile_incomplete'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'profile_incomplete' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Profile Incomplete{statusFilter === 'profile_incomplete' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setStatusFilter('active'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'active' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Active{statusFilter === 'active' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('pending'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'pending' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Pending{statusFilter === 'pending' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('rejected'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'rejected' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Rejected{statusFilter === 'rejected' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('inactive'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'inactive' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Inactive{statusFilter === 'inactive' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                      <button onClick={() => { setStatusFilter('profile_incomplete'); setShowFilterDropdown(false); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#1a2b4a] cursor-pointer flex items-center justify-between ${statusFilter === 'profile_incomplete' ? 'text-teal-400 font-medium' : 'text-slate-400'}`}>Profile Incomplete{statusFilter === 'profile_incomplete' && <div className="w-5 h-5 flex items-center justify-center"><i className="ri-check-line text-teal-400"></i></div>}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111d35] border border-[#1a2b4a] rounded-2xl overflow-x-auto">
          {activeTab === 'clients' ? (
            <ClientsTable 
              clients={filteredClients} 
              searchQuery={searchQuery}
              selectedIds={selectedClientIds}
              onSelectionChange={setSelectedClientIds}
              onUpdate={fetchAccounts}
            />
          ) : (
            <GuardsTable 
              guards={filteredGuards} 
              searchQuery={searchQuery}
              selectedIds={selectedGuardIds}
              onSelectionChange={setSelectedGuardIds}
              onUpdate={fetchAccounts}
            />
          )}
        </div>

        <RecentActivityLog />
      </div>

      <BulkActionsBar
        selectedCount={activeTab === 'clients' ? selectedClientIds.length : selectedGuardIds.length}
        accountType={activeTab}
        onAction={activeTab === 'clients' ? handleBulkClientAction : handleBulkGuardAction}
        onClearSelection={() => activeTab === 'clients' ? setSelectedClientIds([]) : setSelectedGuardIds([])}
        onEmail={() => setShowBulkEmail(true)}
        isProcessing={isProcessingBulk}
      />

      {showBulkEmail && (
        <BulkEmailModal
          recipients={getEmailRecipients()}
          accountType={activeTab}
          onClose={() => setShowBulkEmail(false)}
          onSuccess={() => {
            setShowBulkEmail(false);
            setToast({ message: `Emails queued for ${activeTab === 'clients' ? selectedClientIds.length : selectedGuardIds.length} ${activeTab}`, type: 'success' });
            if (activeTab === 'clients') setSelectedClientIds([]);
            else setSelectedGuardIds([]);
          }}
        />
      )}

      {toast && (
        <div className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3 animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-lg`}></i>
          </div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
