'use client';

import { useState, useEffect, useCallback } from 'react';
import MobileHeader from '../components/MobileHeader';

interface Shift {
  id: string;
  title: string;
  venue: string;
  address: string;
  time: string;
  lat: number;
  lng: number;
}

const activeShift: Shift = {
  id: '1',
  title: 'Door Supervisor',
  venue: 'Fabric Nightclub',
  address: 'Charterhouse St, London EC1A 1NR',
  time: '21:00 – 03:00',
  lat: 51.5204,
  lng: -0.1019,
};

type ClockState = 'idle' | 'locating' | 'confirming' | 'clocked-in' | 'clocking-out' | 'clocked-out';

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ClockInScreen() {
  const [clockState, setClockState] = useState<ClockState>('idle');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successType, setSuccessType] = useState<'in' | 'out'>('in');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (clockState !== 'clocked-in') return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [clockState]);

  const requestLocation = useCallback((intent: 'in' | 'out') => {
    setClockState('locating');
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device.');
      setClockState('idle');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const dist = getDistanceMeters(latitude, longitude, activeShift.lat, activeShift.lng);
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        });
        setClockState('confirming');
      },
      (err) => {
        if (err.code === 1) {
          setLocationError('Location permission denied. Please enable GPS.');
        } else if (err.code === 2) {
          setLocationError('Unable to determine your location. Try again.');
        } else {
          setLocationError('Location request timed out. Try again.');
        }
        setClockState('idle');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const confirmClockIn = () => {
    const now = new Date();
    setClockInTime(now);
    setElapsed(0);
    setClockState('clocked-in');
    setSuccessType('in');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const confirmClockOut = () => {
    setClockState('clocked-out');
    setSuccessType('out');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const dist = location
    ? Math.round(getDistanceMeters(location.lat, location.lng, activeShift.lat, activeShift.lng))
    : null;
  const withinRange = dist !== null && dist <= 300;

  return (
    <div className="flex flex-col h-full bg-[#0B1933] overflow-y-auto">
      <MobileHeader
        title="Clock In / Out"
        subtitle="Attendance"
        role="guard"
        showNotification
        notificationCount={1}
      />

      <div className="flex-1 px-4 pb-24 pt-4 space-y-4">

        {/* Live Clock */}
        <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Current Time</p>
            <p className="text-white text-2xl font-bold font-mono mt-0.5" suppressHydrationWarning={true}>{currentTime}</p>
          </div>
          <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center">
            <i className="ri-time-line text-teal-400 text-2xl"></i>
          </div>
        </div>

        {/* Active Shift Card */}
        <div className="bg-gradient-to-br from-teal-600/30 to-teal-900/30 border border-teal-500/30 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-teal-300 text-xs font-semibold uppercase tracking-wide mb-1">Active Shift</p>
              <p className="text-white font-bold text-base">{activeShift.title}</p>
              <p className="text-slate-300 text-sm">{activeShift.venue}</p>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30">
              Confirmed
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <i className="ri-time-line text-teal-400"></i>
              {activeShift.time}
            </span>
            <span className="flex items-center gap-1.5">
              <i className="ri-map-pin-line text-teal-400"></i>
              {activeShift.address.split(',')[0]}
            </span>
          </div>
        </div>

        {/* Clock Status */}
        {clockState === 'clocked-in' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
                <p className="text-emerald-400 font-semibold text-sm">Clocked In</p>
              </div>
              <p className="text-slate-400 text-xs">
                Since {clockInTime?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <p className="text-white text-3xl font-bold font-mono">{formatDuration(elapsed)}</p>
            <p className="text-slate-400 text-xs mt-1">Time on shift</p>
          </div>
        )}

        {clockState === 'clocked-out' && (
          <div className="bg-slate-500/10 border border-slate-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-checkbox-circle-line text-slate-400 text-lg"></i>
              <p className="text-slate-300 font-semibold text-sm">Shift Ended</p>
            </div>
            <p className="text-white text-2xl font-bold font-mono">{formatDuration(elapsed)}</p>
            <p className="text-slate-400 text-xs mt-1">Total time worked</p>
          </div>
        )}

        {/* GPS Location Panel */}
        {(clockState === 'locating' || clockState === 'confirming') && (
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="ri-map-pin-2-line text-teal-400 text-lg"></i>
              <p className="text-white font-semibold text-sm">GPS Verification</p>
            </div>

            {clockState === 'locating' && (
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full border-4 border-teal-500/30 border-t-teal-400 animate-spin"></div>
                <p className="text-slate-400 text-sm">Acquiring your location…</p>
              </div>
            )}

            {clockState === 'confirming' && location && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0B1933] rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-1">Your Location</p>
                    <p className="text-white text-xs font-mono">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">±{location.accuracy}m accuracy</p>
                  </div>
                  <div className="bg-[#0B1933] rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-1">Site Location</p>
                    <p className="text-white text-xs font-mono">{activeShift.lat.toFixed(4)}, {activeShift.lng.toFixed(4)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Charterhouse St</p>
                  </div>
                </div>

                <div className={`flex items-center gap-3 rounded-xl p-3 ${withinRange ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${withinRange ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                    <i className={`text-xl ${withinRange ? 'ri-map-pin-2-fill text-emerald-400' : 'ri-map-pin-time-line text-amber-400'}`}></i>
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${withinRange ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {withinRange ? 'Within Range' : 'Outside Range'}
                    </p>
                    <p className="text-slate-400 text-xs">{dist}m from site · 300m allowed</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setClockState('idle')}
                    className="flex-1 py-3 rounded-xl border border-[#1e2d4d] text-slate-400 text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={clockState === 'confirming' && clockInTime === null ? confirmClockIn : confirmClockOut}
                    className={`flex-2 flex-grow py-3 rounded-xl text-white text-sm font-bold cursor-pointer whitespace-nowrap ${
                      withinRange
                        ? 'bg-gradient-to-r from-teal-500 to-teal-600'
                        : 'bg-amber-500/80'
                    }`}
                  >
                    {withinRange ? 'Confirm' : 'Override & Confirm'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {locationError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-red-400 text-xl flex-shrink-0 mt-0.5"></i>
            <div>
              <p className="text-red-400 font-semibold text-sm">Location Error</p>
              <p className="text-slate-400 text-xs mt-0.5">{locationError}</p>
            </div>
          </div>
        )}

        {/* Main Action Button */}
        {(clockState === 'idle' || clockState === 'clocked-in' || clockState === 'clocked-out') && (
          <div className="pt-2">
            {clockState === 'idle' && (
              <button
                onClick={() => requestLocation('in')}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-lg shadow-lg shadow-teal-500/30 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center justify-center gap-3">
                  <i className="ri-map-pin-2-fill text-2xl"></i>
                  Clock In with GPS
                </span>
              </button>
            )}
            {clockState === 'clocked-in' && (
              <button
                onClick={() => requestLocation('out')}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-lg shadow-lg shadow-red-500/30 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center justify-center gap-3">
                  <i className="ri-map-pin-2-fill text-2xl"></i>
                  Clock Out with GPS
                </span>
              </button>
            )}
            {clockState === 'clocked-out' && (
              <div className="w-full py-5 rounded-2xl bg-[#111d35] border border-[#1e2d4d] text-slate-500 font-bold text-base text-center">
                Shift Complete — See you next time!
              </div>
            )}
          </div>
        )}

        {/* Attendance Log */}
        <div>
          <h2 className="text-white font-bold text-base mb-3">Recent Attendance</h2>
          <div className="space-y-2">
            {[
              { date: 'Mon 12 May', venue: 'Fabric Nightclub', in: '20:58', out: '03:04', hours: '6h 06m', status: 'verified' },
              { date: 'Sat 10 May', venue: 'O2 Arena', in: '17:02', out: '23:11', hours: '6h 09m', status: 'verified' },
              { date: 'Fri 9 May', venue: 'Westfield Stratford', in: '09:05', out: '17:03', hours: '7h 58m', status: 'verified' },
              { date: 'Wed 7 May', venue: 'XOYO Club', in: '22:01', out: '03:55', hours: '5h 54m', status: 'flagged' },
            ].map((log, i) => (
              <div key={i} className="bg-[#111d35] border border-[#1e2d4d] rounded-xl p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{log.venue}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{log.date}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <div className="text-right">
                    <p className="text-slate-300 text-xs font-mono">{log.in} → {log.out}</p>
                    <p className="text-teal-400 text-xs font-semibold mt-0.5">{log.hours}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    log.status === 'verified'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {log.status === 'verified' ? 'GPS ✓' : 'Flagged'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="absolute top-20 left-4 right-4 z-50">
          <div className={`rounded-2xl p-4 flex items-center gap-3 shadow-2xl ${
            successType === 'in'
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-700 text-white'
          }`}>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className={`text-xl ${successType === 'in' ? 'ri-login-circle-line' : 'ri-logout-circle-line'}`}></i>
            </div>
            <div>
              <p className="font-bold text-sm">{successType === 'in' ? 'Clocked In Successfully!' : 'Clocked Out Successfully!'}</p>
              <p className="text-white/80 text-xs mt-0.5">GPS location recorded & verified</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}