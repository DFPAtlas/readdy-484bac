import Link from 'next/link';
import { mockRacks, mockContainers } from '@/lib/loftlog/mock-data';

export default function StoragePlanning() {
  const totalShelves = mockRacks.reduce((sum, r) => sum + r.totalShelves, 0);
  const totalPositions = totalShelves * 4;
  const occupiedPositions = mockContainers.length;
  const totalLoad = mockRacks.reduce((sum, r) => sum + r.currentLoadKg, 0);
  const totalCapacity = mockRacks.reduce((sum, r) => sum + r.maxLoadKg, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storage Planning</h1>
          <p className="text-sm text-gray-500 mt-1">{mockRacks.length} racks · {mockContainers.length} containers · {occupiedPositions}/{totalPositions} positions used</p>
        </div>
        <Link href="/loftlog/map" className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
          <span className="w-4 h-4 flex items-center justify-center"><i className="ri-map-pin-line text-sm"></i></span>
          Open Loft Map
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Positions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{occupiedPositions}/{totalPositions}</p>
          <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(occupiedPositions/totalPositions)*100}%` }}></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Load</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalLoad}/{totalCapacity} kg</p>
          <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(totalLoad/totalCapacity)*100}%` }}></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Empty Positions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalPositions - occupiedPositions}</p>
          <p className="text-xs text-gray-400 mt-1">Available for new containers</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Rack Overview</h3>
        <div className="space-y-4">
          {mockRacks.map(rack => {
            const rackContainers = mockContainers.filter(c => c.rackId === rack.id);
            const loadPct = Math.round((rack.currentLoadKg / rack.maxLoadKg) * 100);
            return (
              <div key={rack.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{rack.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{rack.code}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${loadPct > 80 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {loadPct}% load
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${loadPct > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${loadPct}%` }}></div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{rack.totalShelves} shelves</span>
                  <span>{rackContainers.length} containers</span>
                  <span>{rack.currentLoadKg}/{rack.maxLoadKg} kg</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}