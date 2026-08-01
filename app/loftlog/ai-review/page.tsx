'use client';

import { useState } from 'react';
import Link from 'next/link';

const tabs = ['Pending', 'Whole-Box Scans', 'Low Confidence', 'Suspected Duplicates', 'Suggested Changes', 'Storage Warnings', 'Confirmed', 'Rejected'];

export default function AiReviewQueuePage() {
  const [activeTab, setActiveTab] = useState('Pending');

  const pendingItems = [
    { id: 'i13', name: 'DeWalt Jigsaw DCS331N', field: 'Name', suggestion: 'DeWalt 18V Cordless Jigsaw (confirmed)', confidence: 0.92, status: 'pending' },
    { id: 'i3', name: 'Coleman Sundome 4-Person Tent', field: 'Category', suggestion: 'Move to Camping → Tent sub-category', confidence: 0.67, status: 'pending' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog" className="hover:text-gray-600 transition-colors">LoftLog</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">AI Review Queue</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold mr-1">Demo AI</span>
            Review AI suggestions before they become confirmed inventory
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab}
            {tab === 'Pending' && <span className="ml-1.5 bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">2</span>}
          </button>
        ))}
      </div>

      {activeTab === 'Pending' && (
        <div className="space-y-4">
          {pendingItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="ri-sparkling-line text-purple-600 text-xs"></i>
                    </span>
                    <span className="text-xs font-semibold text-purple-600 uppercase">AI Suggestion</span>
                    <span className="text-xs text-gray-400">
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Link href={`/loftlog/items/${item.id}`} className="text-sm font-semibold text-gray-900 hover:text-teal-600">
                    {item.name}
                  </Link>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="text-gray-400">{item.field}:</span> {item.suggestion}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors whitespace-nowrap">Confirm</button>
                  <button className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors whitespace-nowrap">Edit</button>
                  <button className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors whitespace-nowrap">Reject</button>
                </div>
              </div>
            </div>
          ))}

          {pendingItems.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-green-600 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-700">All caught up!</h3>
              <p className="text-sm text-gray-500 mt-1">No AI suggestions are pending review.</p>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'Pending' && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-inbox-line text-gray-400 text-2xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-700">No items in {activeTab}</h3>
          <p className="text-sm text-gray-500 mt-1">This tab is empty. Items will appear here as AI processes your catalogue.</p>
        </div>
      )}
    </div>
  );
}