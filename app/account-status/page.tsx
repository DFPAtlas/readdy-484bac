'use client'

import { Suspense } from 'react'
import AccountStatusPageContent from './AccountStatusContent'

export default function AccountStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    }>
      <AccountStatusPageContent />
    </Suspense>
  )
}