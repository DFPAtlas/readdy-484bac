'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Guard {
  id: string;
  full_name: string;
  profile_image_url: string | null;
  sia_licence_number: string;
  sia_verified: boolean;
  rating: number | null;
  total_reviews: number;
  hourly_rate: number;
  location: string;
  postcode: string;
  licence_types: string[];
  years_experience: number;
  willing_to_travel: boolean;
  has_transport: boolean;
  bio: string;
  accepts_direct_bookings: boolean;
  preferred_venue_categories: string[] | null;
}

const licenseOptions = [
  { value: '', label: 'Any Licence' },
  { value: 'door_supervisor', label: 'Door Supervisor' },
  { value: 'security_guard', label: 'Security Guard' },
  { value: 'cctv', label: 'CCTV Operator' },
  { value: 'close_protection', label: 'Close Protection' },
  { value: 'dog_handler', label: 'Dog Handler' },
];

function StarRating({ rating }: { rating: number | null }) {
  const r = Math.round((rating || 0) * 2) / 2;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`text-sm ${
            s <= r ? 'ri-star-fill text-amber-400' : s - 0.5 <= r ? 'ri-star-half-fill text-amber-400' : 'ri-star-line text-slate-600'
          }`}
        ></i>
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating ? rating.toFixed(1) : '0.0'}</span>
    </div>
  );
}

const venueOptions = [
  { value: '', label: 'Any Venue' },
  { value: 'nightclub_bar', label: 'Nightclub / Bar' },
  { value: 'retail_shop', label: 'Retail / Shop' },
  { value: 'construction_site', label: 'Construction Site' },
  { value: 'private_event', label: 'Private Event' },
  { value: 'festival_public_event', label: 'Festival / Public Event' },
  { value: 'warehouse_property', label: 'Warehouse / Property' },
  { value: 'office_building', label: 'Office Building' },
];

function FindGuardContent() {
  const searchParams = useSearchParams();
  const urlPostcode = searchParams.get('postcode') || '';
  const urlLicense = searchParams.get('license') || '';
  const urlVenue = searchParams.get('venue') || '';

  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [postcode, setPostcode] = useState(urlPostcode);
  const [licenseFilter, setLicenseFilter] = useState(urlLicense);
  const [venueFilter, setVenueFilter] = useState(urlVenue);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchGuards();
  }, []);

  const fetchGuards = async () => {
    setLoading(true);
    let query = supabase
      .from('guards')
      .select('id, full_name, profile_image_url, sia_licence_number, sia_verified, rating, total_reviews, hourly_rate, location, postcode, licence_types, years_experience, willing_to_travel, has_transport, bio, accepts_direct_bookings, preferred_venue_categories')
      .eq('is_active', true)
      .eq('verification_status', 'verified')
      .eq('accepts_direct_bookings', true)
      .order('rating', { ascending: false });

    const { data, error } = await query;
    if (!error) setGuards(data || []);
    setLoading(false);
  };

  const filteredGuards = guards.filter((g) => {
    if (licenseFilter && !g.licence_types?.some(l => l.toLowerCase().replace(/\s/g, '_').includes(licenseFilter))) return false;
    if (venueFilter && !g.preferred_venue_categories?.some(v => v === venueFilter)) return false;
    if ((g.rating || 0) < minRating) return false;
    if (postcode && g.postcode) {
      const pc = postcode.trim().toUpperCase().replace(/\s/g, '');
      const gpc = g.postcode.trim().toUpperCase().replace(/\s/g, '');
      if (!gpc.startsWith(pc.slice(0, 2))) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B1933]">
      <div className="bg-gradient-to-br from-[#0f172a] via-[#111d35] to-[#162036] py-16 border-b border-[#1e2d4d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-4">
            <Link href="/" className="text-slate-500 hover:text-white text-sm flex items-center gap-1">
              <i className="ri-arrow-left-line"></i> Back to home
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Find a Guard</h1>
          <p className="text-slate-400">Browse SIA-verified guards available for direct booking</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <div className="w-5 h-5 flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2">
              <i className="ri-map-pin-line text-slate-500 text-sm"></i>
            </div>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Enter postcode (e.g. E1, SW1A)"
              className="w-full pl-10 pr-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 bg-[#162036] border border-[#1e2d4d] rounded-xl text-slate-300 text-sm font-medium hover:bg-[#1a2642] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-filter-3-line"></i> Filters
            </button>
            <button
              onClick={fetchGuards}
              className="px-4 py-3 bg-teal-500 rounded-xl text-white text-sm font-medium hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-1"></i> Refresh
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-4 mb-6 flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Licence Type</label>
              <div className="relative">
                <select value={licenseFilter} onChange={(e) => setLicenseFilter(e.target.value)} className="px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm pr-8 appearance-none">
                  {licenseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Venue Type</label>
              <div className="relative">
                <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)} className="px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-white text-sm pr-8 appearance-none">
                  {venueOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"></i>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">Min Rating</label>
              <div className="flex items-center gap-2">
                {[0, 3, 4, 4.5].map(r => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      minRating === r ? 'bg-teal-500 text-white' : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                    }`}
                  >
                    {r === 0 ? 'Any' : `${r}+`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              {filteredGuards.length} guard{filteredGuards.length !== 1 ? 's' : ''} available for direct booking
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGuards.map((guard) => (
                <div key={guard.id} className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl overflow-hidden hover:border-teal-500/30 transition-all">
                  <div className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative w-16 h-16 flex-shrink-0">
                        {guard.profile_image_url ? (
                          <img src={guard.profile_image_url} alt={guard.full_name} className="w-16 h-16 rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                            {guard.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'G'}
                          </div>
                        )}
                        {guard.sia_verified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#111d35]">
                            <i className="ri-shield-check-fill text-white" style={{ fontSize: '10px' }}></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{guard.full_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating rating={guard.rating} />
                          <span className="text-xs text-slate-500">({guard.total_reviews || 0})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <i className="ri-map-pin-line"></i>
                          {guard.location || guard.postcode || 'UK'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {guard.licence_types?.slice(0, 3).map(l => (
                        <span key={l} className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-xs rounded-full border border-teal-400/20">
                          {l}
                        </span>
                      ))}
                      {guard.willing_to_travel && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-400/20">
                          <i className="ri-car-line mr-0.5"></i>Travels
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                      {guard.bio || `${guard.years_experience || 0}+ years experience. Available for direct bookings.`}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1e2d4d]">
                      <div>
                        <p className="text-xs text-slate-500">From</p>
                        <p className="text-lg font-bold text-teal-400">£{guard.hourly_rate?.toFixed(2) || '12.00'}<span className="text-xs text-slate-500 font-normal">/hr</span></p>
                      </div>
                      <Link
                        href={`/post-job?guard=${guard.id}`}
                        className="bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5"
                      >
                        <i className="ri-calendar-check-line"></i>
                        Request Booking
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredGuards.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-[#162036] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#1e2d4d]">
                  <i className="ri-search-line text-2xl text-slate-500"></i>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No guards match your filters</h3>
                <p className="text-slate-400 mb-4">Try broadening your search or clearing the postcode filter.</p>
                <button
                  onClick={() => { setPostcode(''); setLicenseFilter(''); setVenueFilter(''); setMinRating(0); }}
                  className="text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FindAGuardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B1933]">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <FindGuardContent />
    </Suspense>
  );
}