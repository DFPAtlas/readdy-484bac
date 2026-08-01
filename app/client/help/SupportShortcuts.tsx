'use client';

import Link from 'next/link';

export default function SupportShortcuts() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/client/support" className="group">
        <div className="flex items-center gap-4 p-5 bg-[#111d35] border border-[#1e2d4d] rounded-xl hover:shadow-md hover:border-teal-500/30 transition-all cursor-pointer h-full">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal-500/10 border border-teal-400/20">
            <i className="ri-customer-service-2-line text-teal-400 text-xl" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Contact Support</p>
            <p className="text-xs text-slate-500 mt-0.5">Chat with our team</p>
          </div>
          <div className="ml-auto w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-slate-500 text-lg group-hover:text-teal-400 transition-colors" />
          </div>
        </div>
      </Link>

      <Link href="/client/support?new=general_support" className="group">
        <div className="flex items-center gap-4 p-5 bg-[#111d35] border border-[#1e2d4d] rounded-xl hover:shadow-md hover:border-teal-500/30 transition-all cursor-pointer h-full">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/10 border border-blue-400/20">
            <i className="ri-add-circle-line text-blue-400 text-xl" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Create Ticket</p>
            <p className="text-xs text-slate-500 mt-0.5">Open a new support request</p>
          </div>
          <div className="ml-auto w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-slate-500 text-lg group-hover:text-blue-400 transition-colors" />
          </div>
        </div>
      </Link>

      <Link href="/client/support" className="group">
        <div className="flex items-center gap-4 p-5 bg-[#111d35] border border-[#1e2d4d] rounded-xl hover:shadow-md hover:border-teal-500/30 transition-all cursor-pointer h-full">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-400/20">
            <i className="ri-list-check-2 text-violet-400 text-xl" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">View My Tickets</p>
            <p className="text-xs text-slate-500 mt-0.5">Track existing requests</p>
          </div>
          <div className="ml-auto w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-slate-500 text-lg group-hover:text-violet-400 transition-colors" />
          </div>
        </div>
      </Link>

      <Link href="/client/support?new=guard_no_show" className="group">
        <div className="flex items-center gap-4 p-5 bg-[#111d35] border border-red-500/25 rounded-xl hover:shadow-md hover:border-red-500/40 transition-all cursor-pointer h-full">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/10 border border-red-400/20">
            <i className="ri-alarm-warning-line text-red-400 text-xl" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Report Urgent Issue</p>
            <p className="text-xs text-slate-500 mt-0.5">Guard no-show or emergency</p>
          </div>
          <div className="ml-auto w-5 h-5 flex items-center justify-center">
            <i className="ri-arrow-right-s-line text-slate-500 text-lg group-hover:text-red-400 transition-colors" />
          </div>
        </div>
      </Link>
    </div>
  );
}