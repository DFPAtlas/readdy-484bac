'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useSafeRouter } from '@/hooks/useSafeRouter'
import { resolveAccountState, QuickGuardAccountState } from '@/lib/account-state'
import { logAuditEvent } from '@/lib/qg-error'

const OPEN_PATHS = [
  '/guard/login',
  '/guard/register',
  '/guard/forgot-password',
  '/guard/reset-password',
  '/guard/complete-profile-wizard',
  '/guard/profile',
  '/guard/verification-pending',
  '/guard/verification-failed',
  '/guard/onboarding',
  '/guard/account-status',
]

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    manual_review: 'Manual Review',
    pending_sia_check: 'SIA Check In Progress',
    pending: 'Pending Review',
    rejected: 'Rejected',
    suspended: 'Suspended',
    expired: 'Expired',
    incomplete: 'Incomplete',
    in_progress: 'In Progress',
    not_started: 'Not Started',
    approved_no_dashboard_access: 'Dashboard Not Yet Available',
  }
  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
}

function getStatusExplanation(status: string): string {
  const explanations: Record<string, string> = {
    manual_review: 'Your profile is being manually reviewed by our team. This typically takes 24-48 hours.',
    pending_sia_check: 'We are verifying your SIA licence with the official database.',
    pending: 'Your application is pending review.',
    rejected: 'Your SIA licence verification was not successful.',
    suspended: 'Your account has been temporarily suspended.',
    expired: 'Your SIA licence appears to have expired.',
    incomplete: 'Your profile is not yet complete.',
    in_progress: 'Your verification is currently in progress.',
    not_started: 'You have not yet started the verification process.',
    approved_no_dashboard_access: 'Your guard profile has been approved but dashboard access is still being provisioned.',
  }
  return explanations[status] || 'Your account is currently under review.'
}

export default function GuardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useSafeRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [blockedStatus, setBlockedStatus] = useState<string | null>(null)
  const [guardName, setGuardName] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (OPEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
        if (!cancelled) { setLoading(false); setAllowed(true) }
        return
      }

      const state: QuickGuardAccountState = await resolveAccountState()
      if (cancelled) return

      if (!state.userId) {
        logAuditEvent({ action: 'unauthorized_route_attempt', entityType: 'route', metadata: { path: pathname } })
        router.push('/guard/login')
        return
      }

      if (state.role === 'admin') {
        if (!cancelled) { setLoading(false); setAllowed(true) }
        return
      }

      if (state.role === 'client') {
        logAuditEvent({ userId: state.userId, role: 'client', action: 'role_routing_failure', entityType: 'route', metadata: { path: pathname, reason: 'client_accessed_guard_route' } })
        router.push('/client/dashboard')
        return
      }

      if (state.role !== 'guard') {
        logAuditEvent({ userId: state.userId, action: 'role_routing_failure', entityType: 'route', metadata: { path: pathname, reason: 'no_guard_profile' } })
        router.push('/guard/complete-profile-wizard')
        return
      }

      if (state.accountStatus === 'suspended' || state.accountStatus === 'disabled') {
        logAuditEvent({ userId: state.userId, role: 'guard', action: 'account_suspension_enforced', entityType: 'account', metadata: { status: state.accountStatus, path: pathname } })
        if (!cancelled) {
          setBlockedStatus(state.accountStatus)
          setLoading(false)
          setAllowed(false)
        }
        return
      }

      if (!state.onboardingComplete) {
        logAuditEvent({ userId: state.userId, role: 'guard', action: 'onboarding_redirect', entityType: 'account', metadata: { path: pathname } })
        router.push('/guard/complete-profile-wizard')
        return
      }

      const { data: guardData } = await supabase
        .from('guards')
        .select('full_name, verification_status, dashboard_access')
        .eq('user_id', state.userId)
        .maybeSingle()

      if (cancelled) return

      const vs = guardData?.verification_status || 'unknown'
      setGuardName(guardData?.full_name || '')

      if (vs === 'verified' || vs === 'approved') {
        if (guardData?.dashboard_access === false) {
          logAuditEvent({ userId: state.userId, role: 'guard', action: 'guard_blocked_access', entityType: 'guard', metadata: { verification_status: 'approved_no_dashboard_access', path: pathname } })
          if (!cancelled) {
            setBlockedStatus('approved_no_dashboard_access')
            setLoading(false)
            setAllowed(false)
          }
          return
        }
        if (!cancelled) { setLoading(false); setAllowed(true) }
        return
      }

      if (vs === 'rejected') {
        router.push('/guard/verification-failed')
        return
      }

      if (vs === 'expired') {
        if (!cancelled) {
          setBlockedStatus('expired')
          setLoading(false)
          setAllowed(false)
        }
        return
      }

      logAuditEvent({ userId: state.userId, role: 'guard', action: 'guard_blocked_access', entityType: 'guard', metadata: { verification_status: vs, path: pathname } })
      if (!cancelled) {
        setBlockedStatus(vs)
        setLoading(false)
        setAllowed(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [pathname, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
    router.push('/guard/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B1933]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-600 border-t-teal-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm font-medium">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!allowed && blockedStatus) {
    return (
      <div className="min-h-screen bg-[#0B1933] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="bg-[#111d35] border border-[#1e2d4d] rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-amber-500/15 rounded-full flex items-center justify-center">
              <i className="ri-time-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center"></i>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              {blockedStatus === 'suspended' || blockedStatus === 'disabled' ? 'Account Restricted' : 'Access Restricted'}
            </h1>

            <div className="inline-block px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
              <span className="text-sm font-semibold text-amber-300">
                Status: {getStatusLabel(blockedStatus)}
              </span>
            </div>

            <p className="text-slate-400 mb-6 leading-relaxed">
              {getStatusExplanation(blockedStatus)}
            </p>

            <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-5 mb-6 text-left">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <i className="ri-information-line text-teal-400 w-5 h-5 flex items-center justify-center"></i>
                What to do next
              </h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {blockedStatus === 'in_progress' || blockedStatus === 'pending' || blockedStatus === 'manual_review' || blockedStatus === 'pending_sia_check' || blockedStatus === 'not_started' ? (
                  <>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>Verification is being processed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>You will receive an email when verification is complete</span>
                    </li>
                  </>
                ) : blockedStatus === 'expired' ? (
                  <>
                    <li className="flex items-start gap-2">
                      <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>Your SIA licence has expired</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>Renew your licence and update your profile</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>Your account requires review</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-arrow-right-s-line text-teal-400 mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0"></i>
                      <span>Contact support for assistance</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="flex flex-col items-stretch justify-center gap-3">
              <Link
                href="/guard/profile"
                className="px-6 py-3 bg-teal-500 text-slate-900 rounded-xl font-semibold hover:bg-teal-400 transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="ri-edit-line w-5 h-5 flex items-center justify-center"></i>
                Edit Application
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 bg-[#162236] border border-[#1e2d4d] text-slate-300 rounded-xl font-semibold hover:bg-[#1e2d4d] hover:text-white transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="ri-customer-service-2-line w-5 h-5 flex items-center justify-center"></i>
                Contact Support
              </Link>
              <button
                onClick={handleLogout}
                className="px-6 py-3 text-slate-500 hover:text-slate-300 transition whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <i className="ri-logout-box-line w-5 h-5 flex items-center justify-center"></i>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}