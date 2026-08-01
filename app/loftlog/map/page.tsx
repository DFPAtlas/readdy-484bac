import Link from 'next/link';
import { mockRacks, mockContainers } from '@/lib/loftlog/mock-data';

export default function MapPage() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog" className="hover:text-gray-600 transition-colors">LoftLog</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Loft Map</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loft Map</h1>
          <p className="text-sm text-gray-500 mt-1">Visual layout of your loft storage</p>
        </div>
        <Link href="/loftlog/management/storage" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
          Storage Planning →
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-center mb-8">
          <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${mockRacks.length}, 1fr)` }}>
            {mockRacks.map(rack => {
              const rackContainers = mockContainers.filter(c => c.rackId === rack.id);
              return (
                <div key={rack.id} className="text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{rack.code}</p>
                  <div className="space-y-1.5">
                    {Array.from({ length: rack.totalShelves }, (_, shelfIdx) => {
                      const shelfNum = rack.totalShelves - shelfIdx;
                      const shelfContainers = rackContainers.filter(c => c.shelf === shelfNum);
                      return (
                        <div key={shelfNum} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 w-4">S{shelfNum}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map(pos => {
                              const container = shelfContainers.find(c => c.position === pos);
                              return (
                                <div
                                  key={pos}
                                  className={`w-10 h-10 rounded border text-[9px] flex items-center justify-center font-medium transition-colors ${
                                    container
                                      ? container.status === 'catalogued'
                                        ? 'bg-green-100 border-green-300 text-green-700'
                                        : container.status === 'full'
                                          ? 'bg-amber-100 border-amber-300 text-amber-700'
                                          : 'bg-blue-100 border-blue-300 text-blue-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-300'
                                  }`}
                                  title={container ? `${container.label} (${container.code})` : `Position ${pos} - Empty`}
                                >
                                  {pos}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{rack.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
            Catalogued
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span>
            Full
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span>
            Partial
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></span>
            Empty
          </div>
        </div>
      </div>
    </div>
  );
}