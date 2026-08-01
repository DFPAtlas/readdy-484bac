export default function MessagesSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="w-32 h-6 bg-[#162036] rounded mb-2" />
      {[1,2,3].map(i => (
        <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[#162036] rounded-full flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="w-24 h-4 bg-[#162036] rounded" />
                <div className="w-2 h-2 bg-[#162036] rounded-full" />
              </div>
              <div className="w-32 h-3 bg-[#162036] rounded mb-1" />
              <div className="w-full h-3 bg-[#162036] rounded mb-2" />
              <div className="w-16 h-3 bg-[#162036] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}