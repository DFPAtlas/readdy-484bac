'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SIALicenceStatusCardProps {
  verificationStatus: string | null;
  siaLicenceFrontUrl: string | null;
  siaExpiryDate: string | null;
}

export default function SIALicenceStatusCard({ verificationStatus, siaLicenceFrontUrl, siaExpiryDate }: SIALicenceStatusCardProps) {
  const isExpiringSoon = () => {
    if (!siaExpiryDate) return false;
    const expiry = new Date(siaExpiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 60 && daysUntilExpiry >= 0;
  };

  const isExpired = () => {
    if (!siaExpiryDate) return false;
    return new Date(siaExpiryDate) < new Date();
  };

  const getDaysUntilExpiry = () => {
    if (!siaExpiryDate) return null;
    const expiry = new Date(siaExpiryDate);
    return Math.floor((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  if (verificationStatus === 'approved' && !isExpiringSoon() && !isExpired()) return null;

  if (verificationStatus === 'rejected') {
    return (
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-500/10 rounded-xl flex-shrink-0">
            <i className="ri-close-circle-line text-xl sm:text-2xl text-red-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-red-300 mb-1">SIA Licence Rejected</h3>
            <p className="text-xs sm:text-sm text-red-400/80">
              Your SIA licence verification was rejected. Please re-upload a clear, valid copy of your licence to continue.
            </p>
          </div>
          <Link
            href="/guard/profile"
            className="px-4 py-2.5 bg-red-500/15 text-red-300 rounded-xl text-sm font-semibold hover:bg-red-500/25 transition-colors whitespace-nowrap flex-shrink-0 self-start sm:self-auto"
          >
            Update Licence
          </Link>
        </div>
      </div>
    );
  }

  if (!siaLicenceFrontUrl) {
    return (
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-amber-500/10 rounded-xl flex-shrink-0">
            <i className="ri-id-card-line text-xl sm:text-2xl text-amber-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-amber-300 mb-1">SIA Licence Not Uploaded</h3>
            <p className="text-xs sm:text-sm text-amber-400/80">
              Your SIA licence has not been uploaded yet. Upload it now so our team can verify your account.
            </p>
          </div>
          <Link
            href="/guard/profile"
            className="px-4 py-2.5 bg-amber-500/15 text-amber-300 rounded-xl text-sm font-semibold hover:bg-amber-500/25 transition-colors whitespace-nowrap flex-shrink-0 self-start sm:self-auto"
          >
            Upload Licence
          </Link>
        </div>
      </div>
    );
  }

  if (isExpired()) {
    return (
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-red-500/10 rounded-xl flex-shrink-0">
            <i className="ri-error-warning-line text-xl sm:text-2xl text-red-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-red-300 mb-1">SIA Licence Expired</h3>
            <p className="text-xs sm:text-sm text-red-400/80">
              Your SIA licence expired on {new Date(siaExpiryDate!).toLocaleDateString('en-GB')}. Please renew it and upload your new licence.
            </p>
          </div>
          <Link
            href="/guard/profile"
            className="px-4 py-2.5 bg-red-500/15 text-red-300 rounded-xl text-sm font-semibold hover:bg-red-500/25 transition-colors whitespace-nowrap flex-shrink-0 self-start sm:self-auto"
          >
            Update Licence
          </Link>
        </div>
      </div>
    );
  }

  if (isExpiringSoon()) {
    const days = getDaysUntilExpiry();
    return (
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-amber-500/10 rounded-xl flex-shrink-0">
            <i className="ri-time-line text-xl sm:text-2xl text-amber-400"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-amber-300 mb-1">SIA Licence Expiring Soon</h3>
            <p className="text-xs sm:text-sm text-amber-400/80">
              Your SIA licence expires in <strong className="text-amber-300">{days} days</strong> ({new Date(siaExpiryDate!).toLocaleDateString('en-GB')}). Renew it before it expires to keep your account active.
            </p>
          </div>
          <Link
            href="/guard/profile"
            className="px-4 py-2.5 bg-amber-500/15 text-amber-300 rounded-xl text-sm font-semibold hover:bg-amber-500/25 transition-colors whitespace-nowrap flex-shrink-0 self-start sm:self-auto"
          >
            Update Licence
          </Link>
        </div>
      </div>
    );
  }

  return null;
}