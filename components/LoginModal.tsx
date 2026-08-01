'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import FocusTrap from 'focus-trap-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'guard' | 'client';
}

export default function LoginModal({ isOpen, onClose, userType }: LoginModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const loginPath = userType === 'guard' ? '/guard/login' : '/client/login';
  const registerPath = userType === 'guard' ? '/guard/register' : '/client/register';
  const title = userType === 'guard' ? 'Guard Portal' : 'Client Portal';
  const icon = userType === 'guard' ? 'ri-shield-user-line' : 'ri-briefcase-line';

  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: false,
        allowOutsideClick: true,
        escapeDeactivates: true,
        returnFocusOnDeactivate: true
      }}
    >
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          className="bg-white rounded-2xl max-w-md w-full p-8 relative"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 focus:outline-none"
            aria-label="Close dialog"
          >
            <i className="ri-close-line text-xl" aria-hidden="true"></i>
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className={`${icon} text-3xl text-blue-600`} aria-hidden="true"></i>
            </div>
            <h2 id="login-modal-title" className="text-2xl font-bold text-gray-900 mb-2">
              {title}
            </h2>
            <p className="text-gray-600">
              Sign in or create an account to continue
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href={loginPath}
              prefetch={false}
              className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none"
              onClick={onClose}
            >
              Sign In
            </Link>
            <Link
              href={registerPath}
              prefetch={false}
              className="block w-full bg-white text-blue-600 text-center py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors focus:outline-none"
              onClick={onClose}
            >
              Create Account
            </Link>
          </div>

          <p className="text-sm text-gray-500 text-center mt-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </FocusTrap>
  );
}