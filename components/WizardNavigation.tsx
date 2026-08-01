'use client';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  isNextDisabled?: boolean;
  nextLabel?: string;
  submitLabel?: string;
}

export default function WizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isSubmitting = false,
  isNextDisabled = false,
  nextLabel = 'Continue',
  submitLabel = 'Complete Profile'
}: WizardNavigationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-between pt-8 border-t border-slate-700/50">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-[#162236] hover:bg-slate-700/50 text-slate-300 border border-slate-700/50 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center"></i>
          Back
        </button>
      ) : (
        <div></div>
      )}

      {isLastStep ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <i className="ri-check-line text-xl w-5 h-5 flex items-center justify-center"></i>
              {submitLabel}
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isSubmitting}
          className="flex items-center gap-2 px-8 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {nextLabel}
          <i className="ri-arrow-right-line w-5 h-5 flex items-center justify-center"></i>
        </button>
      )}
    </div>
  );
}
