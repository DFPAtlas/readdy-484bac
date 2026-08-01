'use client';

interface EarningsChartProps {
  monthlyData: { month: string; earned: number; pending: number }[];
}

export default function EarningsChart({ monthlyData }: EarningsChartProps) {
  // Guard against empty data to avoid Math.max on an empty array
  const maxValue = monthlyData.length
    ? Math.max(...monthlyData.map(d => Math.max(d.earned, d.pending)), 1)
    : 1;

  return (
    <div className="bg-[#111d35] rounded-xl border border-[#1e2d4d] p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Earnings Overview</h3>
          <p className="text-sm text-slate-500">Last 6 months</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-400">Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <span className="text-xs text-slate-400">Pending</span>
          </div>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="flex items-end gap-3 h-40">
        {monthlyData.map((data, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full flex gap-1 items-end justify-center"
              style={{ height: '120px' }}
            >
              <div
                className="w-5 bg-emerald-500 rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max((data.earned / maxValue) * 120, 2)}px`,
                }}
                title={`Paid: £${data.earned.toFixed(0)}`}
              />
              <div
                className="w-5 bg-amber-400 rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max((data.pending / maxValue) * 120, 2)}px`,
                }}
                title={`Pending: £${data.pending.toFixed(0)}`}
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">{data.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
