'use client';

import { useState } from 'react';
import Link from 'next/link';
import { mockUsers } from '@/lib/loftlog/mock-data';

export default function UsersSettingsPage() {
  const [inviteEmail, setInviteEmail] = useState('');

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link href="/loftlog/settings" className="hover:text-gray-600 transition-colors">Settings</Link>
        <span className="w-3 h-3 flex items-center justify-center"><i className="ri-arrow-right-s-line text-xs"></i></span>
        <span className="text-gray-600">Users & Access</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Access</h1>
          <p className="text-sm text-gray-500 mt-1">{mockUsers.length} users</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Invite User</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 pr-8">
            <option>Editor</option>
            <option>Viewer</option>
            <option>Admin</option>
          </select>
          <button className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap">
            Send Invite
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Current Users</h3>
        </div>
        {mockUsers.map(user => (
          <div key={user.id} className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{user.displayName.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                user.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                user.role === 'editor' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-600'
              }`}>{user.role}</span>
              <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              {user.role !== 'owner' && (
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <i className="ri-more-2-fill text-sm"></i>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}