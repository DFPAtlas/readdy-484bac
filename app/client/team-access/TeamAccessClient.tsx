'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { hasFeature, CLIENT_FEATURE_KEYS, getAllClientFeatures } from '@/lib/entitlements';
import { useClientAuth } from '@/lib/ClientAuthContext';
import { useRouteGuard } from '@/hooks/useRouteGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import PortalSidebar from '@/components/PortalSidebar';

interface TeamMember {
  configId: string;
  userId: string;
  email: string;
  fullName: string;
  enabledFeatures: string[];
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
}

const FEATURE_LABELS: Record<string, string> = {
  'client.post_job': 'Post Jobs',
  'client.view_guard_profiles': 'View Guard Profiles',
  'client.advanced_matching': 'Advanced Matching',
  'client.priority_support': 'Priority Support',
  'client.job_templates': 'Job Templates',
  'client.analytics_dashboard': 'Analytics Dashboard',
  'client.direct_contact': 'Direct Contact',
  'client.unlimited_jobs': 'Unlimited Jobs',
  'client.bulk_posting': 'Bulk Posting',
  'client.multi_site': 'Multi-Site',
  'client.team_access': 'Team Access',
  'client.custom_contracts': 'Custom Contracts',
  'client.api_access': 'API Access',
  'client.escrow_payments': 'Held Payments',
  'client.job_history': 'Job History',
  'client.job_tracker': 'Job Tracker',
};

export default function TeamAccessClient() {
  const router = useRouter();
  const { user } = useClientAuth();
  const userId = user?.id || null;
  const { checking: routeChecking, blocked } = useRouteGuard(userId);

  const [adminFeatures, setAdminFeatures] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasTeamAccess, setHasTeamAccess] = useState<boolean | null>(null);
  const [sidebarInfo, setSidebarInfo] = useState({ displayName: 'Client', subtitle: 'Free', initials: 'CL' });
  const mountedRef = useRef(true);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(`Auth error: ${authErr.message}`);
      if (!authUser) { router.push('/client/login'); return; }
      if (!mountedRef.current) return;

      const allowed = await hasFeature(authUser.id, 'client.team_access');
      if (!mountedRef.current) return;
      setHasTeamAccess(allowed);
      if (!allowed) { setLoading(false); return; }

      const { data: clientData } = await supabase
        .from('clients')
        .select('company_name, subscription_tier')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (mountedRef.current && clientData) {
        const name = clientData.company_name || 'Client';
        setSidebarInfo({
          displayName: name,
          subtitle: clientData.subscription_tier || 'Free',
          initials: name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        });
      }

      const allFlags = await getAllClientFeatures(authUser.id);
      const features: string[] = [];
      for (const key of CLIENT_FEATURE_KEYS) {
        if (allFlags[key]) features.push(key);
      }
      if (!mountedRef.current) return;
      setAdminFeatures(features);

      const { data: configs, error: configsErr } = await supabase
        .schema('public')
        .from('team_member_configs')
        .select('id, member_user_id, enabled_features')
        .eq('admin_user_id', authUser.id);

      if (configsErr) throw new Error(`Failed to load team members: ${configsErr.message}`);

      if (!configs || configs.length === 0) {
        if (mountedRef.current) { setTeamMembers([]); setLoading(false); }
        return;
      }

      const memberIds = configs.map(c => c.member_user_id);
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', memberIds);

      if (usersErr) throw new Error(`Failed to load member profiles: ${usersErr.message}`);

      const userMap = new Map((usersData || []).map(u => [u.id, u]));
      const members: TeamMember[] = configs.map(c => ({
        configId: c.id,
        userId: c.member_user_id,
        email: userMap.get(c.member_user_id)?.email || 'Unknown',
        fullName: userMap.get(c.member_user_id)?.full_name || 'Unknown',
        enabledFeatures: c.enabled_features || [],
      }));

      if (mountedRef.current) { setTeamMembers(members); setLoading(false); }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || 'Something went wrong loading team data.');
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  // Debounced email search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const { data, error: searchErr } = await supabase
          .from('users')
          .select('id, email, full_name, user_type')
          .ilike('email', `%${q}%`)
          .eq('user_type', 'client')
          .limit(10);

        if (searchErr || !mountedRef.current) {
          if (mountedRef.current) setSearching(false);
          return;
        }

        const existingIds = new Set(teamMembers.map(m => m.userId));
        if (userId) existingIds.add(userId);

        // Exclude users already in ANY team
        const allMemberUserIds = (await supabase
          .from('team_member_configs')
          .select('member_user_id')
          .neq('admin_user_id', userId || ''))
          .data?.map(r => r.member_user_id) || [];

        const excludedIds = new Set([...existingIds, ...allMemberUserIds]);
        setSearchResults((data || []).filter(u => !excludedIds.has(u.id)));
      } finally {
        if (mountedRef.current) setSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, teamMembers, userId]);

  const handleAddMember = async (memberUserId: string) => {
    if (!userId) return;
    setAddingUserId(memberUserId);
    setError(null);

    const { data: insertData, error: insertErr } = await supabase
      .schema('public')
      .from('team_member_configs')
      .insert({
        admin_user_id: userId,
        member_user_id: memberUserId,
        enabled_features: [],
      })
      .select('id')
      .single();

    if (insertErr) {
      const isDuplicate = insertErr.code === '23505' || insertErr.message?.includes('unique constraint');
      if (mountedRef.current) {
        setError(isDuplicate ? 'That user is already on your team.' : (insertErr.message || 'Failed to add member.'));
      }
    } else if (insertData && mountedRef.current) {
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);

      // Append locally instead of full reload
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', memberUserId)
        .single();

      if (userData && mountedRef.current) {
        const newMember: TeamMember = {
          configId: insertData.id,
          userId: memberUserId,
          email: userData.email || 'Unknown',
          fullName: userData.full_name || 'Unknown',
          enabledFeatures: [],
        };
        setTeamMembers(prev => [...prev, newMember]);
      }
    }

    if (mountedRef.current) setAddingUserId(null);
  };

  const handleToggleFeature = async (configId: string, featureKey: string, currentlyEnabled: boolean) => {
    const toggleKey = `${configId}:${featureKey}`;
    setTogglingFeature(toggleKey);

    const member = teamMembers.find(m => m.configId === configId);
    if (!member) { setTogglingFeature(null); return; }

    let newFeatures: string[];
    if (currentlyEnabled) {
      newFeatures = member.enabledFeatures.filter(f => f !== featureKey);
    } else {
      newFeatures = [...member.enabledFeatures, featureKey];
    }

    setTeamMembers(prev => prev.map(m =>
      m.configId === configId ? { ...m, enabledFeatures: newFeatures } : m
    ));

    const { error: updateErr } = await supabase
      .schema('public')
      .from('team_member_configs')
      .update({ enabled_features: newFeatures })
      .eq('id', configId);

    if (updateErr) {
      setTeamMembers(prev => prev.map(m =>
        m.configId === configId ? { ...m, enabledFeatures: member.enabledFeatures } : m
      ));
      if (mountedRef.current) setError(updateErr.message);
    }

    if (mountedRef.current) setTogglingFeature(null);
  };

  const handleRemoveMember = async (configId: string) => {
    setDeletingId(configId);
    setError(null);

    const { error: deleteErr } = await supabase
      .schema('public')
      .from('team_member_configs')
      .delete()
      .eq('id', configId);

    if (deleteErr) {
      if (mountedRef.current) setError(deleteErr.message);
    } else {
      if (mountedRef.current) {
        setRemoveConfirmId(null);
        setTeamMembers(prev => prev.filter(m => m.configId !== configId));
      }
    }

    if (mountedRef.current) setDeletingId(null);
  };

  if (blocked) return null;

  if (hasTeamAccess === false) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
        <PortalSidebar
          role="client"
          displayName={sidebarInfo.displayName}
          subtitle={sidebarInfo.subtitle}
          initials={sidebarInfo.initials}
        />
        <main className="flex-1 min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-lg">
            <UpgradePrompt feature="client.team_access" />
          </div>
        </main>
      </div>
    );
  }

  const featureList = CLIENT_FEATURE_KEYS.filter(k => adminFeatures.includes(k));

  if (loading || routeChecking) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1933] flex flex-col lg:flex-row">
      <PortalSidebar
        role="client"
        displayName={sidebarInfo.displayName}
        subtitle={sidebarInfo.subtitle}
        initials={sidebarInfo.initials}
      />
      <main className="flex-1 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Team Access</h1>
              <p className="text-sm text-slate-400 mt-1">
                Manage team member accounts and their feature access
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-user-add-line"></i>
              Add Team Member
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-line text-red-400"></i>
              </div>
              <p className="text-sm text-red-300 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
              >
                Dismiss
              </button>
              <button
                onClick={() => loadData()}
                className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          )}

          {teamMembers.length === 0 ? (
            <div className="bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-team-line text-3xl text-teal-400"></i>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No team members yet</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                Add team members to give them access to specific features. Each member can have their own set of permissions.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-teal-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-user-add-line"></i>
                Add Your First Team Member
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.configId}
                  className="bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl overflow-hidden"
                >
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a2b4a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-teal-400 font-semibold text-sm">
                          {(member.fullName || member.email).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{member.fullName}</p>
                        <p className="text-xs text-slate-400 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-teal-500/10 text-teal-400 px-2.5 py-1 rounded-full border border-teal-500/20">
                        {member.enabledFeatures.length} of {featureList.length} features
                      </span>
                      <button
                        onClick={() => setRemoveConfirmId(removeConfirmId === member.configId ? null : member.configId)}
                        disabled={deletingId === member.configId}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-40"
                      >
                        {deletingId === member.configId ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className="ri-delete-bin-line"></i>
                        )}
                      </button>
                    </div>
                  </div>

                  {removeConfirmId === member.configId && (
                    <div className="px-5 py-3 bg-red-500/5 border-b border-red-500/10 flex items-center justify-between">
                      <p className="text-sm text-red-300">Remove {member.fullName} from team?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRemoveConfirmId(null)}
                          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1a2b4a] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.configId)}
                          disabled={deletingId === member.configId}
                          className="text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                        >
                          {deletingId === member.configId ? 'Removing...' : 'Confirm Remove'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {featureList.map((featureKey) => {
                        const enabled = member.enabledFeatures.includes(featureKey);
                        const isToggling = togglingFeature === `${member.configId}:${featureKey}`;
                        const label = FEATURE_LABELS[featureKey] || featureKey.replace('client.', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                        return (
                          <div
                            key={featureKey}
                            className="flex items-center justify-between bg-[#0a1525] rounded-xl px-4 py-3 border border-[#1a2b4a]/50"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${enabled ? 'bg-teal-400 shadow-sm shadow-teal-400/30' : 'bg-slate-700'}`}></div>
                              <span className="text-sm text-slate-300 truncate">{label}</span>
                            </div>
                            <button
                              onClick={() => handleToggleFeature(member.configId, featureKey, enabled)}
                              disabled={isToggling}
                              className={`relative w-10 h-[22px] rounded-full transition-all duration-200 flex-shrink-0 ml-3 cursor-pointer ${
                                enabled ? 'bg-teal-500 shadow-sm shadow-teal-500/30' : 'bg-slate-700'
                              } ${isToggling ? 'opacity-50' : ''}`}
                            >
                              <span
                                className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200 ${
                                  enabled ? 'left-[calc(100%-1.188rem)]' : 'left-0.5'
                                }`}
                              ></span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); }}></div>
          <div className="relative bg-[#0f1d3a] border border-[#1a2b4a] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Add Team Member</h2>
              <button
                onClick={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a2b4a] cursor-pointer"
              >
                <i className="ri-close-line text-slate-400"></i>
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by email... (min 2 characters)"
                className="flex-1 bg-[#0a1525] border border-[#1a2b4a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-colors"
              />
              <button
                onClick={() => {}}
                disabled={searching || searchQuery.length < 2}
                className="px-4 py-2.5 bg-teal-500 text-white text-sm font-semibold rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                <p className="text-sm text-slate-500 text-center py-6">No users found</p>
              )}
              {searchQuery.length < 2 && (
                <p className="text-sm text-slate-600 text-center py-6">Type at least 2 characters to search</p>
              )}
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-[#0a1525] rounded-xl px-4 py-3 border border-[#1a2b4a]/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{user.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleAddMember(user.id)}
                    disabled={addingUserId === user.id}
                    className="px-3 py-1.5 bg-teal-500/15 text-teal-400 text-xs font-semibold rounded-lg hover:bg-teal-500/25 transition-colors cursor-pointer whitespace-nowrap ml-3 disabled:opacity-50"
                  >
                    {addingUserId === user.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}