'use client';

import FocusTrap from 'focus-trap-react';

interface BookingAuthModalProps {
  isOpen: boolean;
  email?: string;
  onClose: () => void;
  onRegister: () => void;
  onLogin: () => void;
}

export default function BookingAuthModal({ isOpen, email, onClose, onRegister, onLogin }: BookingAuthModalProps) {
  if (!isOpen) return null;

  return (
    <FocusTrap focusTrapOptions={{initialFocus:'#booking-auth-register',escapeDeactivates:false,allowOutsideClick:true}}><div onKeyDown={event=>{if(event.key==='Escape')onClose();}} className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="booking-auth-title">
      <div className="absolute inset-0 bg-[#05101F]/80" onClick={onClose} aria-hidden="true"></div>
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0A1730]/[0.97] p-6 shadow-2xl ring-1 ring-inset ring-white/5 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <i className="ri-close-line text-xl"></i>
        </button>

        <div className="w-14 h-14 bg-red-500/15 border border-red-400/20 rounded-2xl flex items-center justify-center mb-5">
          <i className="ri-shield-user-line text-2xl text-red-400"></i>
        </div>

        <h2 id="booking-auth-title" className="text-2xl font-bold text-white mb-2">
          Your booking details are saved
        </h2>
        <p className="text-slate-300 mb-1">
          Create a free client account (or log in) to review and confirm your request. Your details carry over automatically, and no guard is notified until you confirm posting.
        </p>
        {email && <p className="text-sm text-teal-300 mb-5 break-all">{email}</p>}
        {!email && <div className="mb-5"></div>}

        <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3 mb-5 flex items-start gap-2.5">
          <i className="ri-shield-check-line text-emerald-400 mt-0.5" aria-hidden="true"></i>
          <p className="text-sm text-slate-200">No card details are taken until you select a guard and reach payment.</p>
        </div>

        <div className="space-y-3">
          <button
            id="booking-auth-register"
            type="button"
            onClick={onRegister}
            className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]"
          >
            <i className="ri-user-add-line"></i>
            Create a free account
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/15 py-3.5 rounded-xl font-semibold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1730]"
          >
            <i className="ri-login-box-line"></i>
            I already have an account
          </button>
        </div>
      </div>
    </div></FocusTrap>
  );
}