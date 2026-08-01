interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  height?: string;
  className?: string;
  type?: 'cards' | 'list' | 'table' | 'stat' | 'custom' | 'message' | 'form' | 'tabs' | 'detail' | 'grid';
}

export default function LoadingSkeleton({
  rows = 3,
  columns = 1,
  height = 'h-20',
  className = '',
  type = 'list',
}: LoadingSkeletonProps) {
  if (type === 'stat') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-${columns} gap-3 mb-6 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-3 flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 bg-[#162036] rounded-lg flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-[#162036] rounded w-16" />
              <div className="h-3 bg-[#162036] rounded w-10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 animate-pulse">
            <div className="h-6 bg-[#162036] rounded w-3/4 mb-3" />
            <div className="h-4 bg-[#162036] rounded w-1/2 mb-2" />
            <div className="h-4 bg-[#162036] rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'grid') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${columns} gap-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-5 animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#162036] rounded-lg" />
              <div className="h-4 bg-[#162036] rounded w-24" />
            </div>
            <div className="h-4 bg-[#162036] rounded w-full" />
            <div className="h-4 bg-[#162036] rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`bg-[#111d35] rounded-xl border border-[#1e2d4d] overflow-hidden ${className}`}>
        <div className="bg-[#162036] border-b border-[#1e2d4d] px-6 py-4 animate-pulse">
          <div className="h-4 bg-[#1e2d4d] rounded w-full" />
        </div>
        <div className="divide-y divide-[#1e2d4d]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
              <div className="h-4 bg-[#162036] rounded w-1/4" />
              <div className="h-4 bg-[#162036] rounded w-1/4" />
              <div className="h-4 bg-[#162036] rounded w-1/6" />
              <div className="h-4 bg-[#162036] rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'message') {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
            <div className={`bg-[#162036] rounded-xl p-3 max-w-[75%] ${i % 2 === 0 ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
              <div className="h-3 bg-[#111d35] rounded w-48 mb-2" />
              <div className="h-3 bg-[#111d35] rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'form') {
    return (
      <div className={`space-y-6 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-3 bg-[#162036] rounded w-24" />
            <div className="h-10 bg-[#162036] rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'tabs') {
    return (
      <div className={`flex items-center gap-2 mb-6 animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-9 bg-[#162036] rounded-xl w-24" />
        ))}
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#162036] rounded w-1/2" />
          <div className="h-4 bg-[#162036] rounded w-full" />
          <div className="h-4 bg-[#162036] rounded w-3/4" />
          <div className="h-4 bg-[#162036] rounded w-1/2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#162036] rounded-xl p-4 h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} bg-[#162036] rounded-xl animate-pulse`} />
      ))}
    </div>
  );
}