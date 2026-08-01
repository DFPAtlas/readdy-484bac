'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface RateGuardModalProps {
  jobId: string
  guardId: string
  guardName: string
  jobTitle?: string
  shiftDate?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function StarRow({ label, value, onChange, size = 'md' }: { label: string; value: number; onChange: (v: number) => void; size?: 'sm' | 'md' }) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  const starClass = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-300 font-medium min-w-[120px]">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="cursor-pointer focus:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={star <= display ? '#F59E0B' : 'none'}
              stroke={star <= display ? '#F59E0B' : '#475569'}
              strokeWidth={1.5}
              className={`${starClass} transition-colors duration-150`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-xs text-amber-400 font-medium min-w-[60px]">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][value]}
          </span>
        )}
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-300 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            value === true
              ? 'bg-emerald-500 text-white'
              : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
          }`}
        >
          <i className="ri-check-line mr-1"></i>Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            value === false
              ? 'bg-red-500 text-white'
              : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
          }`}
        >
          <i className="ri-close-line mr-1"></i>No
        </button>
      </div>
    </div>
  )
}

export default function RateGuardModal({
  jobId,
  guardId,
  guardName,
  jobTitle,
  shiftDate,
  isOpen,
  onClose,
  onSuccess,
}: RateGuardModalProps) {
  const [overall, setOverall] = useState(0)
  const [punctuality, setPunctuality] = useState(0)
  const [professionalism, setProfessionalism] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [appearance, setAppearance] = useState(0)
  const [reliability, setReliability] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [wouldHireAgain, setWouldHireAgain] = useState<boolean | null>(null)
  const [siteInstructionsFollowed, setSiteInstructionsFollowed] = useState<boolean | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<string>('present')
  const [reportIssue, setReportIssue] = useState(false)
  const [issueCategory, setIssueCategory] = useState<string>('')
  const [issueDescription, setIssueDescription] = useState('')
  const [showEscalation, setShowEscalation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (overall === 0) {
      setError('Please give an overall star rating.')
      return
    }
    if (reportIssue && !issueCategory) {
      setError('Please select an issue category or turn off Report Issue.')
      return
    }
    setLoading(true)
    setError('')

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      setError('Unable to verify your session. Please log in again.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('reviews').insert({
      job_id: jobId,
      guard_id: guardId,
      client_id: userData.user.id,
      rating: overall,
      review_text: reviewText.trim() || null,
      private_note: privateNote.trim() || null,
      punctuality: punctuality || null,
      professionalism: professionalism || null,
      communication: communication || null,
      appearance: appearance || null,
      reliability: reliability || null,
      would_hire_again: wouldHireAgain,
      site_instructions_followed: siteInstructionsFollowed,
      attendance_status: attendanceStatus,
      issue_reported: reportIssue,
      issue_category: reportIssue ? issueCategory : null,
      issue_description: reportIssue ? issueDescription.trim() || null : null,
      status: 'published',
      review_status: reportIssue ? 'issue_reported' : 'reviewed',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError("You've already reviewed this guard for this job.")
      } else {
        setError('Something went wrong. Please try again.')
      }
      setLoading(false)
      return
    }

    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('guard_id', guardId)
      .eq('status', 'published')

    if (allReviews && allReviews.length > 0) {
      const total = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0)
      const average = Math.round((total / allReviews.length) * 10) / 10

      await supabase
        .from('guards')
        .update({
          average_rating: average,
          total_reviews: allReviews.length,
        })
        .eq('id', guardId)
    }

    setLoading(false)
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      onSuccess()
      onClose()
    }, 1500)
  }

  const handleClose = () => {
    if (!loading) {
      setOverall(0)
      setPunctuality(0)
      setProfessionalism(0)
      setCommunication(0)
      setAppearance(0)
      setReliability(0)
      setReviewText('')
      setPrivateNote('')
      setWouldHireAgain(null)
      setSiteInstructionsFollowed(null)
      setAttendanceStatus('present')
      setReportIssue(false)
      setIssueCategory('')
      setIssueDescription('')
      setShowEscalation(false)
      setError('')
      setSuccess(false)
      onClose()
    }
  }

  const issueCategories = [
    { value: 'no_show', label: 'No-show', icon: 'ri-user-unfollow-line' },
    { value: 'late_arrival', label: 'Late Arrival', icon: 'ri-time-line' },
    { value: 'poor_performance', label: 'Poor Performance', icon: 'ri-emotion-unhappy-line' },
    { value: 'unprofessional', label: 'Unprofessional Conduct', icon: 'ri-user-settings-line' },
    { value: 'uniform_issue', label: 'Uniform / Presentation', icon: 'ri-t-shirt-line' },
    { value: 'safety_concern', label: 'Safety Concern', icon: 'ri-shield-cross-line' },
    { value: 'other', label: 'Other', icon: 'ri-more-line' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 overflow-y-auto">
      <div className="bg-[#111d35] rounded-2xl shadow-2xl w-full max-w-lg border border-[#1e2d4d] relative my-auto">
        <div className="sticky top-0 bg-[#111d35] rounded-t-2xl border-b border-[#1e2d4d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Rate Your Guard</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {guardName}
              {jobTitle && ` · ${jobTitle}`}
              {shiftDate && ` · ${new Date(shiftDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer rounded-full hover:bg-[#162036] transition-colors"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-lg" />
              <p className="text-sm font-medium text-emerald-400">Review submitted successfully. Thank you!</p>
            </div>
          )}

          {/* Overall Rating */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Overall Rating</label>
              <span className="text-xs text-amber-400 font-medium">
                {overall > 0 ? ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][overall] : 'Required'}
              </span>
            </div>
            <StarRow label="" value={overall} onChange={setOverall} size="md" />
          </div>

          {/* Category Ratings */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white block">Category Ratings</label>
            <p className="text-xs text-slate-500">Optional — but helps us improve matching</p>
            <div className="space-y-2">
              <StarRow label="Punctuality" value={punctuality} onChange={setPunctuality} size="sm" />
              <StarRow label="Professionalism" value={professionalism} onChange={setProfessionalism} size="sm" />
              <StarRow label="Communication" value={communication} onChange={setCommunication} size="sm" />
              <StarRow label="Appearance" value={appearance} onChange={setAppearance} size="sm" />
              <StarRow label="Reliability" value={reliability} onChange={setReliability} size="sm" />
            </div>
          </div>

          {/* Written Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Written Feedback</label>
            <p className="text-xs text-slate-500">This will be visible on the guard's public profile</p>
            <textarea
              value={reviewText}
              onChange={(e) => { if (e.target.value.length <= 500) setReviewText(e.target.value) }}
              rows={3}
              placeholder="Share your experience with this guard..."
              className="w-full bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-xs text-slate-600 text-right">{reviewText.length}/500</p>
          </div>

          {/* Private Note */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="ri-lock-line text-slate-500" />
              Private Note to QuickGuard
            </label>
            <p className="text-xs text-slate-500">Only visible to our admin team</p>
            <textarea
              value={privateNote}
              onChange={(e) => { if (e.target.value.length <= 500) setPrivateNote(e.target.value) }}
              rows={2}
              placeholder="Anything you want to tell us privately..."
              className="w-full bg-[#162036] border border-[#1e2d4d] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-xs text-slate-600 text-right">{privateNote.length}/500</p>
          </div>

          {/* Quick Toggles */}
          <div className="space-y-3 bg-[#162036] rounded-xl border border-[#1e2d4d] p-4">
            <ToggleRow
              label="Would you hire this guard again?"
              value={wouldHireAgain}
              onChange={setWouldHireAgain}
            />
            <ToggleRow
              label="Site instructions followed?"
              value={siteInstructionsFollowed}
              onChange={setSiteInstructionsFollowed}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300 font-medium">Attendance</span>
              <div className="flex items-center gap-2">
                {['present', 'late', 'no_show'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setAttendanceStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      attendanceStatus === status
                        ? status === 'present'
                          ? 'bg-emerald-500 text-white'
                          : status === 'late'
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-[#111d35] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                    }`}
                  >
                    {status === 'present' && <i className="ri-check-line mr-1" />}
                    {status === 'late' && <i className="ri-time-line mr-1" />}
                    {status === 'no_show' && <i className="ri-user-unfollow-line mr-1" />}
                    {status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'No-show'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Report Issue */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setReportIssue(!reportIssue)}
              className={`flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                reportIssue ? 'text-red-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <i className={`ri-error-warning-line ${reportIssue ? 'text-red-400' : 'text-slate-500'}`} />
              {reportIssue ? 'Issue Report Enabled' : 'Report an Issue'}
              <span className={`ml-1 w-9 h-5 rounded-full flex items-center transition-colors ${reportIssue ? 'bg-red-500 justify-end' : 'bg-slate-600 justify-start'}`}>
                <span className="w-4 h-4 rounded-full bg-white mx-0.5" />
              </span>
            </button>

            {reportIssue && (
              <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 space-y-3">
                <p className="text-xs text-red-400 font-semibold">Select an issue category</p>
                <div className="grid grid-cols-2 gap-2">
                  {issueCategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setIssueCategory(cat.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        issueCategory === cat.value
                          ? 'bg-red-500 text-white'
                          : 'bg-[#162036] text-slate-400 border border-[#1e2d4d] hover:text-slate-300'
                      }`}
                    >
                      <i className={cat.icon} />
                      {cat.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={issueDescription}
                  onChange={(e) => { if (e.target.value.length <= 500) setIssueDescription(e.target.value) }}
                  rows={2}
                  placeholder="Describe the issue in detail..."
                  className="w-full bg-[#162036] border border-red-500/25 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
                <p className="text-xs text-slate-600 text-right">{issueDescription.length}/500</p>
              </div>
            )}
          </div>

          {/* Escalation (shown after low rating or issue) */}
          {(overall <= 2 || reportIssue) && !showEscalation && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-400 mb-2">Need help resolving this?</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/client/support?new=${reportIssue ? issueCategory || 'general_support' : 'poor_performance'}&job=${jobId}&guard=${guardId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-customer-service-2-line" />
                  Create Support Ticket
                </Link>
                <Link
                  href={`/client/support?new=refund_request&job=${jobId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-semibold border border-violet-500/20 hover:bg-violet-500/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-refund-line" />
                  Request Refund Review
                </Link>
                <button
                  onClick={() => setShowEscalation(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162036] text-slate-400 text-xs font-semibold border border-[#1e2d4d] hover:text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-message-3-line" />
                  Message Support
                </button>
              </div>
            </div>
          )}

          {showEscalation && (
            <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-2">Message QuickGuard Support</p>
              <p className="text-xs text-slate-500 mb-2">We'll look into your concern and reply within 24 hours.</p>
              <Link
                href={`/client/support?new=general_support&job=${jobId}&guard=${guardId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-send-plane-line" />
                Open Support Chat
              </Link>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-lg px-3 py-2">
              <i className="ri-error-warning-line mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#111d35] rounded-b-2xl border-t border-[#1e2d4d] px-6 py-4 flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e2d4d] text-sm font-semibold text-slate-400 hover:bg-[#162036] cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || overall === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-loader-4-line animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-star-fill" />
                Submit Review
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}