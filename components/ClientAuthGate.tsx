'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { withRequestDeadline } from '@/lib/request-deadline'
import { supabase } from '@/lib/supabase'
import { useSafeRouter } from '@/hooks/useSafeRouter'
import { useClientAuth } from '@/lib/ClientAuthContext'
import { resolveAccountState, QuickGuardAccountState } from '@/lib/account-state'
import { logAuditEvent } from '@/lib/qg-error'

const OPEN_PATHS = [
  '/client/login',
  '/client/register',
  '/client/forgot-password',
  '/client/reset-password',
  '/client/complete-profile-wizard',
  '/client/payment/success',
  '/client/onboarding',
  '/client/account-status',
]

export default function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const router = useSafeRouter()
  const pathname = usePathname()
  const { setAuth, userId: contextOwner, isLoaded } = useClientAuth()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [verifiedKey, setVerifiedKey] = useState('')
  const [retry, setRetry] = useState(0)
  const key = JSON.stringify([pathname, contextOwner, isLoaded])
  const [blockedTitle, setBlockedTitle] = useState('Access Restricted')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAllowed(false)

    const check = async () => {
      try {
      if (OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
        if (!cancelled) { setLoading(false); setAllowed(true); setVerifiedKey(key) }
        return
      }

      if (!isLoaded) return
      const state: QuickGuardAccountState = await withRequestDeadline(resolveAccountState())
      if (cancelled) return

      if (state.userId && state.userId !== contextOwner) throw new Error("Account context changed")
      if (!state.userId) {
        logAuditEvent({ action: 'unauthorized_route_attempt', entityType: 'route', metadata: { path: pathname } })
        router.push('/client/login')
        return
      }

      if (state.role === 'admin') {
        setAuth({
          user: { id: state.userId, email: state.email } as any,
          clientId: '',
          companyName: 'Admin',
          subscriptionTier: 'N/A',
        })
        if (!cancelled) { setLoading(false); setAllowed(true); setVerifiedKey(key) }
        return
      }

      if (state.role === 'guard') {
        logAuditEvent({ userId: state.userId, role: 'guard', action: 'role_routing_failure', entityType: 'route', metadata: { path: pathname, reason: 'guard_accessed_client_route' } })
        router.push('/guard/dashboard')
        return
      }

      if (state.role !== 'client') {
        logAuditEvent({ userId: state.userId, action: 'role_routing_failure', entityType: 'route', metadata: { path: pathname, reason: 'no_client_profile' } })
        router.push('/client/complete-profile-wizard')
        return
      }

      if (state.accountStatus === 'suspended' || state.accountStatus === 'disabled') {
        logAuditEvent({ userId: state.userId, role: 'client', action: 'account_suspension_enforced', entityType: 'account', metadata: { status: state.accountStatus, path: pathname } })
        if (!cancelled) {
          setLoading(false)
          setAllowed(false)
          setBlockedTitle(state.accountStatus === 'suspended' ? 'Account Suspended' : 'Account Disabled')
          setBlockedReason('Your account has been suspended. Please contact support for assistance.')
        }
        return
      }

      if (!state.onboardingComplete) {
        logAuditEvent({ userId: state.userId, role: 'client', action: 'onboarding_redirect', entityType: 'account', metadata: { path: pathname } })
        router.push('/client/complete-profile-wizard')
        return
      }

      const { data: clientData, error: profileError } = await withRequestDeadline(supabase
        .from('clients')
        .select('id, contact_name, company_name, subscription_tier')
        .eq('user_id', state.userId)
        .maybeSingle())

      if (cancelled) return
      if (profileError) throw profileError

      const { data: { user }, error: authError } = await withRequestDeadline(supabase.auth.getUser())

      if (cancelled) return
      if (authError || user?.id !== state.userId) throw new Error('Account changed')
      setAuth({
        user,
        clientId: clientData?.id || '',
        companyName: clientData?.company_name || clientData?.contact_name || 'Client',
        subscriptionTier: clientData?.subscription_tier || 'Free',
      })

      if (!cancelled) { setLoading(false); setAllowed(true); setVerifiedKey(key) }
      } catch {
        if (!cancelled) { setLoading(false); setAllowed(false); setBlockedTitle('Account verification failed'); setBlockedReason('Your account could not be verified. Reload this page to retry.'); }
      }
    }

    check()
    return () => { cancelled = true }
  }, [pathname, router, setAuth, contextOwner, isLoaded, key, retry])

  if (loading || (allowed && verifiedKey !== key)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm font-medium">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-error-warning-line text-3xl text-red-600 w-8 h-8 flex items-center justify-center"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{blockedTitle}</h1>
          <p className="text-gray-500 mb-6">{blockedReason}</p>
          {blockedTitle === 'Account verification failed' && <button onClick={() => setRetry(value => value + 1)} className="block mx-auto mb-4 underline">Retry account verification</button>}
          <Link
            href="/contact"
            className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer font-medium"
          >
            Contact Support
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              if (typeof window !== 'undefined') {
                localStorage.clear()
                sessionStorage.clear()
              }
              router.push('/client/login')
            }}
            className="block mx-auto mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}