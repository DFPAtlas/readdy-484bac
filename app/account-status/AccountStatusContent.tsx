'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useSafeRouter } from '@/hooks/useSafeRouter'
import { resolveAccountState, getAccountStatusDisplay, QuickGuardAccountState } from '@/lib/account-state'

const REASON_MESSAGES: Record<string, { title: string; description: string }> = {
  suspended: {
    title: 'Account Suspended',
    description: 'Your account has been temporarily suspended. This may be due to a policy violation or payment issue. Please contact our support team for assistance.',
  },
  disabled: {
    title: 'Account Disabled',
    description: 'Your account has been disabled. Please contact support to discuss reactivation options.',
  },
  licence_expired: {
    title: 'Licence Expired',
    description: 'Your SIA licence has expired. You must renew your licence before you can continue using the platform. Please update your licence details in your profile.',
  },
  deletion_requested: {
    title: 'Account Deletion Requested',
    description: 'A request to delete your account has been received. If this was a mistake, please contact support immediately.',
  },
  onboarding: {
    title: 'Complete Your Profile',
    description: 'Your profile needs to be completed before you can access all features.',
  },
}

export default function AccountStatusContent() {
  const searchParams = useSearchParams()
  const router = useSafeRouter()
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<QuickGuardAccountState | null>(null)
  const reason = searchParams.get('reason') || ''

  useEffect(() => {
    let cancelled = false
    resolveAccountState().then(s => {
      if (!cancelled) {
        setState(s)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  const msg = REASON_MESSAGES[reason] || {
    title: 'Account Status',
    description: getAccountStatusDisplay(state?.accountStatus || 'disabled'),
  }

  const isGuard = state?.role === 'guard'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer whitespace-nowrap">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-arrow-left-line text-lg"></i>
              </div>
              Back to Homepage
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
              <i className="ri-error-warning-line text-4xl text-amber-600 w-10 h-10 flex items-center justify-center"></i>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">{msg.title}</h1>

            <div className="inline-block px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full mb-4">
              <span className="text-sm font-semibold text-amber-700">
                {getAccountStatusDisplay(state?.accountStatus || 'disabled')}
              </span>
            </div>

            <p className="text-gray-500 mb-8 leading-relaxed">{msg.description}</p>

            <div className="space-y-3">
              {isGuard && reason === 'licence_expired' && (
                <Link
                  href="/guard/profile"
                  className="block w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition whitespace-nowrap cursor-pointer"
                >
                  Update Licence Details
                </Link>
              )}

              <Link
                href="/contact"
                className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition whitespace-nowrap cursor-pointer"
              >
                Contact Support
              </Link>

              <button
                onClick={handleSignOut}
                className="w-full text-gray-400 hover:text-gray-600 py-2 transition whitespace-nowrap cursor-pointer text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}