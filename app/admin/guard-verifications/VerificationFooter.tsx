import ChecklistProgress from './ChecklistProgress';

interface VerificationFooterProps {
  checks: Record<string, boolean>;
  processing: boolean;
  allChecksCompleted: boolean;
  hasBlockers: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
}

const sectionLabels: Record<string, string> = {
  personal_info: 'Personal Information',
  sia_license: 'SIA License',
  professional_details: 'Professional Details',
  availability: 'Availability',
  subscription: 'Profile Completeness',
};

export default function VerificationFooter({ checks, processing, allChecksCompleted, hasBlockers, onApprove, onReject, onOverride }: VerificationFooterProps) {
  const checklistItems = Object.entries(checks).map(([key, checked]) => ({
    label: sectionLabels[key] || key,
    checked,
  }));

  return (
    <div className="space-y-4 pt-4">
      <ChecklistProgress
        title="Verification Progress"
        items={checklistItems}
        color="blue"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onApprove}
          disabled={!allChecksCompleted || processing}
          className="flex-1 min-w-0 bg-green-600 text-white py-3.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <i className="ri-checkbox-circle-line text-xl w-5 h-5 flex items-center justify-center"></i>
              Approve Guard
            </span>
          )}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          className="flex-1 min-w-0 bg-red-600 text-white py-3.5 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="flex items-center justify-center gap-2">
            <i className="ri-close-circle-line text-xl w-5 h-5 flex items-center justify-center"></i>
            Reject Application
          </span>
        </button>
      </div>

      <div className="border-t border-[#1a2b4a] pt-4">
        <button
          onClick={onOverride}
          disabled={processing}
          className="w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
        >
          <span className="flex items-center justify-center gap-2">
            <i className="ri-shield-flash-line text-lg w-5 h-5 flex items-center justify-center"></i>
            Override &amp; Force Approve{hasBlockers ? ` (Skip All Checks)` : ''}
          </span>
        </button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Bypasses all verification checks and missing document requirements. Use with caution — this action is logged.
        </p>
      </div>
    </div>
  );
}