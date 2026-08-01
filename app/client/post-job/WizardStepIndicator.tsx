'use client';

interface Step {
  num: number;
  label: string;
  icon: string;
}

interface WizardStepIndicatorProps {
  steps: Step[];
  activeStep: number;
  onStepClick: (num: number) => void;
  stepHasError: (num: number) => boolean;
}

export default function WizardStepIndicator({ steps, activeStep, onStepClick, stepHasError }: WizardStepIndicatorProps) {
  return (
    <div className="bg-[#111d35] rounded-2xl shadow-sm border border-[#1e2d4d] p-4">
      <div className="flex items-center justify-between gap-1">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => onStepClick(step.num)}
              className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeStep === step.num
                  ? 'bg-teal-500 text-white'
                  : stepHasError(step.num)
                  ? 'text-red-400 bg-red-500/10 border border-red-500/25'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#162036]'
              }`}
            >
              {stepHasError(step.num) && activeStep !== step.num && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <i className="ri-error-warning-fill text-white" style={{ fontSize: '9px' }}></i>
                </span>
              )}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                activeStep === step.num ? 'bg-white/20' : stepHasError(step.num) ? 'bg-red-500/15 text-red-400' : 'bg-[#162036] text-slate-400'
              }`}>
                {stepHasError(step.num) && activeStep !== step.num
                  ? <i className="ri-close-line text-red-400" style={{ fontSize: '11px' }}></i>
                  : step.num}
              </div>
              <span className="text-xs font-medium hidden lg:inline truncate">{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${activeStep > step.num ? 'bg-teal-500' : 'bg-[#1e2d4d]'}`}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}