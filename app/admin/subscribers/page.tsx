'use client';


import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

import { supabase } from '@/lib/supabase';
import { GuardListError, loadAdminGuardList, guardDisplayPage } from '@/lib/admin-guard-list';
import GuardListPagination from '@/components/admin/GuardListPagination';

interface GuardSubscriber {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  postcode: string | null;
  date_of_birth: string | null;
  sia_licence_number: string | null;
  sia_expiry_date: string | null;
  years_experience: number | null;
  hourly_rate: number | null;
  bio: string | null;
  certifications: string[] | null;
  available_days: string[] | null;
  profile_image_url: string | null;
  verification_status: string | null;
  is_active: boolean | null;
  profile_completed: boolean | null;
  rating: number | null;
  total_reviews: number | null;
  total_jobs_completed: number | null;
  created_at: string;
  verified_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  user_id: string | null;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<GuardSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [selectedSubscriber, setSelectedSubscriber] = useState<GuardSubscriber | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [listPage, setListPage] = useState(1);
  const activeRef = useRef(true);
  const requestRef = useRef<AbortController | null>(null);

  const fetchSubscribers = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const isCurrent = () => activeRef.current && requestRef.current === controller && !controller.signal.aborted;
    setLoading(true);
    setError(null);
    setSubscribers([]);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isCurrent()) return;
      if (sessionError || !session?.access_token) throw new GuardListError('Your admin session has expired. Sign in again.', true);
      const records = await loadAdminGuardList<GuardSubscriber>({ status: 'all', token: session.access_token, signal: controller.signal });
      if (!isCurrent()) return;
      setSubscribers(records);
      setListPage(1);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof GuardListError ? err.message : 'Unable to load subscribers. Please retry.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void fetchSubscribers();
    return () => { activeRef.current = false; requestRef.current?.abort(); };
  }, [fetchSubscribers]);

  const openDetailModal = (subscriber: GuardSubscriber) => {
    setSelectedSubscriber(subscriber);
    setShowDetailModal(true);
  };

  const filteredSubscribers = subscribers.filter(sub => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !sub.verification_status || sub.verification_status === 'pending';
    if (filter === 'verified') return sub.verification_status === 'approved' || sub.verification_status === 'verified';
    if (filter === 'rejected') return sub.verification_status === 'rejected';
    return true;
  });

  const visiblePage = guardDisplayPage(filteredSubscribers, listPage);

  const pendingCount = subscribers.filter(s => !s.verification_status || s.verification_status === 'pending').length;
  const verifiedCount = subscribers.filter(s => s.verification_status === 'approved' || s.verification_status === 'verified').length;
  const rejectedCount = subscribers.filter(s => s.verification_status === 'rejected').length;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscribers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <section aria-label="Guard application reviews" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-950">Review guard applications</h2>
          <p className="mt-1 text-sm text-blue-900">Approve or reject guards in Guard Verifications after reviewing their application. Select the guard there to complete the review; use the All tab if it is not in Pending.</p>
          <Link href="/admin/guard-verifications" className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open Guard Verifications</Link>
        </section>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
              <i className="ri-error-warning-line text-red-500 text-lg"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Error loading subscribers</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchSubscribers}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-orange-100 rounded-lg">
                <i className="ri-time-line text-2xl text-orange-600 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                Pending
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{error ? '—' : pendingCount}</h3>
            <p className="text-sm text-gray-600">Awaiting Verification</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-green-100 rounded-lg">
                <i className="ri-checkbox-circle-line text-2xl text-green-600 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                Verified
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{error ? '—' : verifiedCount}</h3>
            <p className="text-sm text-gray-600">Approved Guards</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-lg">
                <i className="ri-close-circle-line text-2xl text-red-600 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">
                Rejected
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{error ? '—' : rejectedCount}</h3>
            <p className="text-sm text-gray-600">Declined Applications</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setFilter('pending'); setListPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({error ? '—' : pendingCount})
            </button>
            <button
              onClick={() => { setFilter('verified'); setListPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'verified' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Verified ({error ? '—' : verifiedCount})
            </button>
            <button
              onClick={() => { setFilter('rejected'); setListPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected ({error ? '—' : rejectedCount})
            </button>
            <button
              onClick={() => { setFilter('all'); setListPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({error ? '—' : subscribers.length})
            </button>
          </div>
          <button
            onClick={fetchSubscribers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-refresh-line text-sm"></i>
            </div>
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          {visiblePage.items.map((subscriber) => {
            const status = subscriber.verification_status || 'pending';
            const statusColors: Record<string, string> = {
              pending: 'bg-orange-100 text-orange-700',
              approved: 'bg-green-100 text-green-700',
              verified: 'bg-green-100 text-green-700',
              rejected: 'bg-red-100 text-red-700'
            };

            return (
              <div key={subscriber.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold text-xl flex-shrink-0">
                      {subscriber.full_name?.charAt(0) || 'G'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-gray-900">{subscriber.full_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.pending}`}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-mail-line text-sm"></i>
                          </div>
                          <span>{subscriber.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-phone-line text-sm"></i>
                          </div>
                          <span>{subscriber.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-map-pin-line text-sm"></i>
                          </div>
                          <span>{[subscriber.location, subscriber.postcode].filter(Boolean).join(', ') || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-calendar-line text-sm"></i>
                          </div>
                          <span>Registered: {formatDate(subscriber.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className={`ri-shield-check-line ${subscriber.sia_licence_number ? 'text-green-600' : 'text-gray-400'} text-sm`}></i>
                          </div>
                          <span className={subscriber.sia_licence_number ? 'text-green-600 font-medium' : 'text-gray-500'}>
                            SIA: {subscriber.sia_licence_number || 'Not provided'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-briefcase-line text-blue-600 text-sm"></i>
                          </div>
                          <span className="text-gray-700">Experience: {subscriber.years_experience ?? 0} years</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <i className="ri-star-line text-yellow-500 text-sm"></i>
                          </div>
                          <span className="text-gray-700">Rating: {subscriber.rating ?? 'New'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => openDetailModal(subscriber)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
                    >
                      Quick View
                    </button>
                    {status === 'pending' && (
                      <Link href="/admin/guard-verifications" className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap">
                        Review application
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSubscribers.length === 0 && !error && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-4">
                <i className="ri-user-line text-3xl text-gray-400 w-8 h-8 flex items-center justify-center"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No subscribers found</h3>
              <p className="text-gray-600">No subscribers match the selected filter</p>
            </div>
          )}
        </div>
        {!error && <GuardListPagination page={visiblePage.page} totalItems={filteredSubscribers.length} onPageChange={setListPage} />}
      </div>

      {showDetailModal && selectedSubscriber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-gray-900">Subscriber Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                aria-label="Close subscriber details"
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-2xl text-gray-600 w-6 h-6 flex items-center justify-center"></i>
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b">
                <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold text-3xl flex-shrink-0">
                  {selectedSubscriber.full_name?.charAt(0) || 'G'}
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-1">{selectedSubscriber.full_name}</h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedSubscriber.verification_status === 'verified' || selectedSubscriber.verification_status === 'approved' ? 'bg-green-100 text-green-700' :
                    selectedSubscriber.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {(selectedSubscriber.verification_status || 'pending').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                  <p className="text-gray-900">{selectedSubscriber.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number</label>
                  <p className="text-gray-900">{selectedSubscriber.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Location</label>
                  <p className="text-gray-900">{[selectedSubscriber.location, selectedSubscriber.postcode].filter(Boolean).join(', ') || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Date of Birth</label>
                  <p className="text-gray-900">{formatDate(selectedSubscriber.date_of_birth)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">SIA Licence Number</label>
                  <p className="text-gray-900 font-medium">{selectedSubscriber.sia_licence_number || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">SIA Expiry</label>
                  <p className="text-gray-900">{formatDate(selectedSubscriber.sia_expiry_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Experience</label>
                  <p className="text-gray-900">{selectedSubscriber.years_experience ?? 0} years</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Hourly Rate</label>
                  <p className="text-gray-900">{selectedSubscriber.hourly_rate ? `£${Number(selectedSubscriber.hourly_rate).toFixed(2)}/hr` : 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Registered Date</label>
                  <p className="text-gray-900">{formatDate(selectedSubscriber.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Rating</label>
                  <p className="text-gray-900">{selectedSubscriber.rating ?? 'New guard'}</p>
                </div>
              </div>

              {selectedSubscriber.bio && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Bio</label>
                  <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedSubscriber.bio}</p>
                </div>
              )}

              {selectedSubscriber.certifications && selectedSubscriber.certifications.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Certifications</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubscriber.certifications.map((cert: string, index: number) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSubscriber.available_days && selectedSubscriber.available_days.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Available Days</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubscriber.available_days.map((day: string, index: number) => (
                      <span key={index} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSubscriber.verification_status === 'rejected' && selectedSubscriber.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label className="text-sm font-medium text-red-700 mb-1 block">Rejection Reason</label>
                  <p className="text-red-900">{selectedSubscriber.rejection_reason}</p>
                </div>
              )}

              {(!selectedSubscriber.verification_status || selectedSubscriber.verification_status === 'pending') && (
                <div className="pt-4 border-t">
                  <Link href="/admin/guard-verifications" className="inline-flex px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap">
                    Review application in Guard Verifications
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
