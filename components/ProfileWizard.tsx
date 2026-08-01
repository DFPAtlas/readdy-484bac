'use client';

import { useState } from 'react';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: string;
}

interface ProfileWizardProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  allowSkipAhead?: boolean;
}

export default function ProfileWizard({ 
  steps, 
  currentStep, 
  onStepClick,
  allowSkipAhead = false 
}: ProfileWizardProps) {
  return (
    <div className="mb-12">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 h-1 bg-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>

          <div className="relative flex items-start justify-between">
            {steps.map((step, index) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isClickable = allowSkipAhead || isCompleted || isCurrent;

              return (
                <div 
                  key={step.id} 
                  className="flex flex-col items-center"
                  style={{ width: `${100 / steps.length}%` }}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && onStepClick?.(step.id)}
                    disabled={!isClickable}
                    className={`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg transition-all mb-3 ${
                      isCompleted
                        ? 'bg-teal-500 text-slate-900 shadow-lg cursor-pointer hover:scale-110'
                        : isCurrent
                        ? 'bg-teal-500 text-slate-900 shadow-lg ring-4 ring-teal-500/30'
                        : !isClickable
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isCompleted ? (
                      <i className="ri-check-line text-2xl w-6 h-6 flex items-center justify-center"></i>
                    ) : (
                      <i className={`${step.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
                    )}
                  </button>
                  
                  <div className="text-center px-2">
                    <h3 className={`text-sm font-semibold mb-1 transition-colors ${
                      isCurrent ? 'text-teal-400' : isCompleted ? 'text-teal-400' : 'text-slate-500'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-xs transition-colors ${
                      isCurrent ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 bg-[#111d35] border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-teal-500/15 rounded-full flex-shrink-0">
              <i className="ri-lightbulb-line text-teal-400 text-xl"></i>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-1">
                Step {currentStep} of {steps.length}: {steps[currentStep - 1]?.title}
              </h4>
              <p className="text-sm text-slate-400">
                {steps[currentStep - 1]?.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
