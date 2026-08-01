export default function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
            <div className="w-8 h-8 bg-[#162036] rounded-lg mb-2" />
            <div className="w-20 h-6 bg-[#162036] rounded mb-1" />
            <div className="w-24 h-3 bg-[#162036] rounded" />
          </div>
        ))}
      </div>
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
        <div className="w-32 h-5 bg-[#162036] rounded mb-3" />
        <div className="w-full h-2 bg-[#162036] rounded-full mb-3" />
        <div className="w-16 h-3 bg-[#162036] rounded" />
      </div>
      <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-4">
        <div className="w-24 h-5 bg-[#162036] rounded mb-3" />
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="bg-[#162036] rounded-lg p-3 border border-[#1e2d4d]">
              <div className="w-32 h-4 bg-[#1e2d4d] rounded mb-1" />
              <div className="w-40 h-3 bg-[#1e2d4d] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}