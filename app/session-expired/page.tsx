'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SessionExpiredPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
    }
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <i className="ri-timer-line text-4xl text-gray-500 w-10 h-10 flex items-center justify-center"></i>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Expired</h1>
        <p className="text-gray-500 mb-8">Your session has expired for your security. Please sign in again to continue.</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/guard/login"
            className="px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
          >
            Guard Login
          </Link>
          <Link
            href="/client/login"
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition whitespace-nowrap cursor-pointer"
          >
            Client Login
          </Link>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition cursor-pointer">
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}