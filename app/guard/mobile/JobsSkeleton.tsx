export default function JobsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="w-40 h-6 bg-[#162036] rounded mb-2" />
      {[1,2,3].map(i => (
        <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <div className="w-40 h-4 bg-[#162036] rounded mb-1" />
          <div className="w-24 h-3 bg-[#162036] rounded mb-3" />
          <div className="flex gap-3 mb-3">
            <div className="w-20 h-3 bg-[#162036] rounded" />
            <div className="w-20 h-3 bg-[#162036] rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div className="w-16 h-4 bg-[#162036] rounded" />
            <div className="w-16 h-8 bg-[#162036] rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}