'use client';


import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [selectedSubscriber, setSelectedSubscriber] = useState<GuardSubscriber | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-guards?status=all`;
      const response = await fetch(edgeUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || 'Failed to load subscribers');
      }

      setSubscribers(result.data || []);
    } catch (err: any) {
      console.error('Error fetching subscribers:', err?.message || err);
      setError(err?.message || 'Failed to load subscribers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const approveSubscriber = async (subscriberId: string) => {
    if (!confirm('Are you sure you want to approve this subscriber and activate their guard account?')) {
      return;
    }

    setProcessingId(subscriberId);
    try {
      const subscriber = subscribers.find(s => s.id === subscriberId);

      const { error: updateError } = await supabase
        .from('guards')
        .update({
          verification_status: 'approved',
          is_active: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', subscriberId);

      if (updateError) throw updateError;

      if (subscriber && subscriber.user_id) {
        try {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: subscriber.user_id,
              title: 'Application Approved',
              message: 'Congratulations! Your guard application has been approved. You can now start accepting jobs.',
              type: 'success',
              is_read: false,
              link: '/guard/dashboard',
              created_at: new Date().toISOString()
            });

          if (notificationError) {
            console.error('Notification error:', notificationError);
          }
        } catch (notifError) {
          console.error('Failed to send notification:', notifError);
        }
      }

      await fetchSubscribers();
      setShowDetailModal(false);
      setSelectedSubscriber(null);

      setToast({ message: 'Guard approved successfully and moved to Verified tab!', type: 'success' });
      setTimeout(() => setToast(null), 3000);

    } catch (error: any) {
      console.error('Error approving subscriber:', error);

      setToast({ message: 'Failed to approve subscriber. Please try again.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setProcessingId(null);
    }
  };

  const rejectSubscriber = async (subscriberId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setProcessingId(subscriberId);
    try {
      const subscriber = subscribers.find(s => s.id === subscriberId);

      const { error: updateError } = await supabase
        .from('guards')
        .update({
          verification_status: 'rejected',
          is_active: false,
          rejection_reason: reason,
          rejected_at: new Date().toISOString()
        })
        .eq('id', subscriberId);

      if (updateError) throw updateError;

      if (subscriber && subscriber.user_id) {
        try {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: subscriber.user_id,
              title: 'Application Rejected',
              message: `Unfortunately, your guard application has been rejected. Reason: ${reason}. Please contact support for more information.`,
              type: 'warning',
              is_read: false,
              link: '/guard/dashboard',
              created_at: new Date().toISOString()
            });

          if (notificationError) {
            console.error('Notification error:', notificationError);
          }
        } catch (notifError) {
          console.error('Failed to send notification:', notifError);
        }
      }

      await fetchSubscribers();
      setShowDetailModal(false);
      setSelectedSubscriber(null);

      setToast({ message: 'Guard rejected and moved to Rejected tab.', type: 'success' });
      setTimeout(() => setToast(null), 3000);

    } catch (error: any) {
      console.error('Error rejecting subscriber:', error);

      setToast({ message: 'Failed to reject subscriber. Please try again.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setProcessingId(null);
    }
  };

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
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
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
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{pendingCount}</h3>
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
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{verifiedCount}</h3>
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
            <h3 className="text-3xl font-bold text-gray-900 mb-1">{rejectedCount}</h3>
            <p className="text-sm text-gray-600">Declined Applications</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'pending' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('verified')}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'verified' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({subscribers.length})
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
          {filteredSubscribers.map((subscriber) => {
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
                      <>
                        <button
                          onClick={() => approveSubscriber(subscriber.id)}
                          disabled={processingId === subscriber.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
                        >
                          {processingId === subscriber.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                              Processing...
                            </>
                          ) : (
                            'Approve'
                          )}
                        </button>
                        <button
                          onClick={() => rejectSubscriber(subscriber.id)}
                          disabled={processingId === subscriber.id}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
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
      </div>

      {showDetailModal && selectedSubscriber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-gray-900">Subscriber Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
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
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => approveSubscriber(selectedSubscriber.id)}
                    disabled={processingId === selectedSubscriber.id}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    {processingId === selectedSubscriber.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      'Approve Subscriber'
                    )}
                  </button>
                  <button
                    onClick={() => rejectSubscriber(selectedSubscriber.id)}
                    disabled={processingId === selectedSubscriber.id}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    Reject Subscriber
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
