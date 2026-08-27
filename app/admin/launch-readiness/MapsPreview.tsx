'use client';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function MapsPreview() {
  if (!MAPS_KEY) {
    return (
      <div className="bg-[#111d35] rounded-2xl p-6 border border-red-500/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-400">
            <i className="ri-map-pin-line text-xl"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Maps Embed preview unavailable</h3>
            <p className="text-sm text-slate-400 mt-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured, so the map cannot render.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111d35] rounded-2xl p-5 border border-[#1a2b4a] shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-400">
          <i className="ri-map-pin-line text-xl"></i>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Maps Embed API preview</h3>
          <p className="text-xs text-slate-500 mt-0.5">Confirm the map below renders correctly to validate the embed key.</p>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-[#1a2b4a]">
        <iframe
          title="Maps Embed API preview"
          className="w-full h-64 block"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=London,UK`}
        />
      </div>
    </div>
  );
}