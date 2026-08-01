'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { geocodePostcode } from '@/lib/geocoding';
import JobMapEmbed from './JobMapEmbed';

interface NearMeJob {
  id: string;
  job_title: string;
  job_description: string | null;
  venue_city: string;
  venue_postcode: string | null;
  number_of_guards: number;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  urgency: string | null;
  sia_licence_required: boolean;
  uniform_required: boolean;
  additional_requirements: string | null;
  created_at: string;
  company_name: string | null;
  distance_km: number;
  latitude: number | null;
  longitude: number | null;
}

export default function JobsNearMeFilter() {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState(25);
  const [postcode, setPostcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<NearMeJob[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (mapRef.current) {
        const rect = mapRef.current.getBoundingClientRect();
        setMapSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const loadSavedLocation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: guard } = await supabase
        .from('guards')
        .select('home_latitude, home_longitude, default_search_radius_km')
        .eq('user_id', user.id)
        .maybeSingle();
      if (guard?.home_latitude && guard?.home_longitude) {
        setLat(guard.home_latitude);
        setLng(guard.home_longitude);
        if (guard.default_search_radius_km) setRadius(guard.default_search_radius_km);
        fetchJobs(guard.home_latitude, guard.home_longitude, guard.default_search_radius_km || 25);
      }
    };
    loadSavedLocation();
  }, []);

  const saveLocation = async (latitude: number, longitude: number, searchRadius: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('guards')
      .update({
        home_latitude: latitude,
        home_longitude: longitude,
        default_search_radius_km: searchRadius,
      })
      .eq('user_id', user.id);
  };

  const fetchJobs = async (searchLat: number, searchLng: number, searchRadius: number) => {
    setLoading(true);
    setError('');
    setHasSearched(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('jobs_near_point', {
        search_lat: searchLat,
        search_lng: searchLng,
        radius_km: searchRadius,
        job_status: 'open',
      });
      if (rpcError) throw rpcError;
      setJobs((data as NearMeJob[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load nearby jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectLocation = () => {
    setDetecting(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setDetecting(false);
        saveLocation(latitude, longitude, radius);
        fetchJobs(latitude, longitude, radius);
      },
      () => {
        setDetecting(false);
        setError('Location access denied. Enter your postcode below.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePostcodeSearch = async () => {
    if (!postcode.trim()) return;
    setLoading(true);
    setError('');
    const geo = await geocodePostcode(postcode.trim());
    if (!geo) {
      setError('Could not find that postcode. Please check and try again.');
      setLoading(false);
      return;
    }
    setLat(geo.latitude);
    setLng(geo.longitude);
    saveLocation(geo.latitude, geo.longitude, radius);
    fetchJobs(geo.latitude, geo.longitude, radius);
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (lat !== null && lng !== null) {
      saveLocation(lat, lng, newRadius);
      fetchJobs(lat, lng, newRadius);
    }
  };

  const getZoomFromRadius = (r: number) => {
    if (r <= 5) return 13;
    if (r <= 10) return 12;
    if (r <= 25) return 11;
    return 10;
  };

  const getMercatorOffset = (jobLat: number, jobLng: number, zoom: number) => {
    const TILE_SIZE = 256;
    const scale = TILE_SIZE * Math.pow(2, zoom);
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const mercatorX = (longitude: number) => ((longitude + 180) / 360) * scale;
    const mercatorY = (latitude: number) => {
      const latRad = toRad(latitude);
      return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
    };
    return {
      x: mercatorX(jobLng) - mercatorX(lng!),
      y: mercatorY(jobLat) - mercatorY(lat!),
    };
  };

  const getPinPosition = (job: NearMeJob) => {
    if (!mapRef.current || job.latitude == null || job.longitude == null || lat == null || lng == null) return null;
    const zoom = getZoomFromRadius(radius);
    const offset = getMercatorOffset(job.latitude, job.longitude, zoom);
    const centerX = mapSize.width / 2;
    const centerY = mapSize.height / 2;
    return {
      left: centerX + offset.x,
      top: centerY + offset.y,
    };
  };

  const scrollToJob = (jobId: string) => {
    setActiveJobId(jobId);
    const el = document.getElementById(`job-card-${jobId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setActiveJobId(null), 2500);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case 'immediate':
        return { classes: 'bg-red-100 text-red-700 border border-red-200', icon: 'ri-flashlight-line', label: 'Immediate' };
      case 'urgent':
        return { classes: 'bg-amber-100 text-amber-700 border border-amber-200', icon: 'ri-alarm-warning-line', label: 'Urgent' };
      case 'standard':
        return { classes: 'bg-green-100 text-green-700 border border-green-200', icon: 'ri-time-line', label: 'Standard' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Find Jobs Near You</h3>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={handleDetectLocation}
            disabled={detecting}
            className="flex items-center gap-2 bg-teal-500 text-slate-900 px-4 py-2.5 rounded-xl font-semibold hover:bg-teal-400 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {detecting ? (
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="ri-map-pin-line"></i>
            )}
            Use My Location
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Enter postcode..."
              className="flex-1 px-4 py-2.5 bg-[#0e1628] border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
            />
            <button
              onClick={handlePostcodeSearch}
              disabled={!postcode.trim() || loading}
              className="bg-slate-700 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-600 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-search-line"></i>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-400">Radius:</span>
          {[5, 10, 25, 50].map((r) => (
            <button
              key={r}
              onClick={() => handleRadiusChange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                radius === r
                  ? 'bg-teal-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>

        {hasSearched && jobs.length > 0 && lat != null && lng != null && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                showMap
                  ? 'bg-teal-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <i className={showMap ? 'ri-list-check' : 'ri-map-2-line'}></i>
              {showMap ? 'Hide map' : 'Show on map'}
            </button>
            <span className="text-xs text-slate-500">
              {showMap ? 'Scroll down to see job list' : 'View all jobs on a larger map'}
            </span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm mt-3 flex items-center gap-1">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}

        {hasSearched && !loading && jobs.length === 0 && !error && (
          <p className="text-slate-400 text-sm mt-3">No jobs found within {radius} km. Try increasing the radius.</p>
        )}
      </div>

      {showMap && lat != null && lng != null && (
        <div ref={mapRef} className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-[#111d35]">
          <iframe
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=${getZoomFromRadius(radius)}&output=embed`}
            width="100%"
            height="500"
            style={{ border: 0, filter: 'grayscale(0.2)' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Nearby jobs map"
          />
          {jobs.map((job) => {
            const pos = getPinPosition(job);
            if (!pos) return null;
            const isActive = activeJobId === job.id;
            return (
              <button
                key={job.id}
                onClick={() => scrollToJob(job.id)}
                className={`absolute z-10 -translate-x-1/2 -translate-y-full cursor-pointer group transition-transform ${isActive ? 'scale-125' : 'hover:scale-110'}`}
                style={{ left: pos.left, top: pos.top }}
                title={`${job.job_title} — ${job.distance_km.toFixed(1)} km`}
              >
                <div className={`relative flex flex-col items-center ${isActive ? 'animate-bounce' : ''}`}>
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-lg mb-0.5 ${isActive ? 'bg-teal-400 text-slate-900' : 'bg-slate-900/90 text-teal-400 border border-teal-400/30'}`}>
                    {job.distance_km.toFixed(1)} km
                  </div>
                  <div className={`w-3 h-3 rounded-full border-2 shadow-lg ${isActive ? 'bg-teal-400 border-slate-900' : 'bg-teal-500 border-white'}`} />
                  <div className={`w-0.5 h-3 ${isActive ? 'bg-teal-400' : 'bg-teal-500/60'}`} />
                </div>
              </button>
            );
          })}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 bg-[#0e1628]/90 backdrop-blur-sm flex items-center justify-between z-20">
            <p className="text-xs text-slate-500">
              Showing jobs within <span className="text-teal-400 font-semibold">{radius} km</span> of your location
            </p>
            <p className="text-xs text-slate-500">
              {jobs.length} job{jobs.length === 1 ? '' : 's'} found
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111d35] border border-slate-700/50 rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
              <div className="flex gap-4 mb-4">
                <div className="h-4 bg-slate-700 rounded w-24"></div>
                <div className="h-4 bg-slate-700 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {jobs.map((job) => (
          <article
            id={`job-card-${job.id}`}
            key={job.id}
            className={`bg-[#111d35] border rounded-2xl p-6 hover:border-teal-500/30 transition-all ${activeJobId === job.id ? 'border-teal-400 ring-2 ring-teal-400/30' : 'border-slate-700/50'}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-xl font-bold text-white">{job.job_title}</h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-teal-500/10 text-teal-400 border border-teal-400/20">
                    <i className="ri-map-pin-line"></i>
                    {job.distance_km.toFixed(1)} km away
                  </span>
                  {(() => {
                    const badge = getUrgencyBadge(job.urgency);
                    return badge ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.classes}`}>
                        <i className={badge.icon}></i>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-slate-400 mb-3">{job.company_name || 'Private Client'}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-4">
                  <span className="flex items-center gap-1">
                    <i className="ri-map-pin-line text-teal-400"></i>
                    {job.venue_city}{job.venue_postcode ? `, ${job.venue_postcode}` : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line text-teal-400"></i>
                    {formatDate(job.start_date)}
                    {job.end_date && job.end_date !== job.start_date && (
                      <> – {formatDate(job.end_date)}</>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line text-teal-400"></i>
                    {formatTime(job.start_time)} – {formatTime(job.end_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-team-line text-teal-400"></i>
                    {job.number_of_guards} {job.number_of_guards === 1 ? 'Guard' : 'Guards'}
                  </span>
                </div>
                {job.job_description && (
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">{job.job_description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {job.sia_licence_required && (
                    <span className="bg-teal-500/10 text-teal-400 border border-teal-400/20 px-3 py-1 rounded-full text-xs font-medium">
                      <i className="ri-shield-check-line mr-1"></i>SIA Required
                    </span>
                  )}
                  {job.uniform_required && (
                    <span className="bg-purple-500/10 text-purple-400 border border-purple-400/20 px-3 py-1 rounded-full text-xs font-medium">
                      <i className="ri-shirt-line mr-1"></i>Uniform Required
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right ml-6 flex flex-col items-end gap-3">
                <div>
                  <div className="text-3xl font-bold text-teal-400 mb-1">£{Number(job.hourly_rate).toFixed(2)}</div>
                  <p className="text-sm text-slate-500">per hour</p>
                </div>
                <Link
                  href={`/jobs/${job.id}`}
                  prefetch={false}
                  className="block bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all whitespace-nowrap text-center shadow-lg hover:shadow-teal-500/20"
                >
                  View Details
                </Link>
                {job.latitude != null && job.longitude != null && (
                  <div className="w-48 hidden sm:block">
                    <JobMapEmbed
                      latitude={job.latitude}
                      longitude={job.longitude}
                      height={120}
                    />
                    <p className="text-[10px] text-slate-500 mt-1 text-right">Approximate area</p>
                  </div>
                )}
              </div>
            </div>
            {job.latitude != null && job.longitude != null && (
              <div className="sm:hidden mt-4">
                <JobMapEmbed
                  latitude={job.latitude}
                  longitude={job.longitude}
                  height={160}
                />
                <p className="text-[10px] text-slate-500 mt-1 text-right">Approximate area</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}