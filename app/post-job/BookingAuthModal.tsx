'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="booking-auth-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true"></div>
      <div className="relative w-full max-w-md bg-[#111d35] border border-[#1e2d4d] rounded-2xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-xl"></i>
        </button>

        <div className="w-14 h-14 bg-red-500/15 border border-red-400/20 rounded-2xl flex items-center justify-center mb-5">
          <i className="ri-shield-user-line text-2xl text-red-400"></i>
        </div>

        <h2 id="booking-auth-title" className="text-2xl font-bold text-white mb-2">
          Your booking details are saved
        </h2>
        <p className="text-slate-400 mb-1">
          Create a free client account (or log in) to send your request to verified guards. Your details carry over automatically.
        </p>
        {email && <p className="text-sm text-teal-400 mb-5 break-all">{email}</p>}
        {!email && <div className="mb-5"></div>}

        <div className="bg-[#162036] border border-[#1e2d4d] rounded-xl p-3 mb-5 flex items-start gap-2.5">
          <i className="ri-shield-check-line text-emerald-400 mt-0.5"></i>
          <p className="text-sm text-slate-300">No card required until you select a guard.</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onRegister}
            className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-user-add-line"></i>
            Create a free account
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="w-full bg-[#162036] hover:bg-[#1a2642] text-white border border-[#1e2d4d] py-3.5 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-login-box-line"></i>
            I already have an account
          </button>
        </div>
      </div>
    </div>
  );
}