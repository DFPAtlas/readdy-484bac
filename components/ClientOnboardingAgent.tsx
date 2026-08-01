'use client';

import { useState } from 'react';
import { logClientActivity, ACTIVITY_CATEGORIES } from '@/lib/client-activity';

interface ClientOnboardingAgentProps {
  clientId?: string | null;
  hasJobs: boolean;
  isFreeOrStarter: boolean;
  profileCompleted: boolean;
  page: 'onboarding' | 'dashboard' | 'post-job';
}

interface HelpTopic {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'first-job',
    label: 'How to post my first job',
    icon: 'ri-briefcase-line',
    prompt: 'I need help posting my first security job on QuickGuard. Can you walk me through the steps?',
  },
  {
    id: 'guard-matching',
    label: 'How guard matching works',
    icon: 'ri-user-search-line',
    prompt: 'How does QuickGuard match my job with security guards? What should I expect?',
  },
  {
    id: 'payment',
    label: 'Payment process',
    icon: 'ri-bank-card-line',
    prompt: 'How does the payment and held job payment process work on QuickGuard? When do guards get paid?',
  },
  {
    id: 'selecting-guards',
    label: 'Selecting the right guards',
    icon: 'ri-shield-user-line',
    prompt: 'How do I choose the best security guards for my job? What should I look for in their profiles?',
  },
  {
    id: 'completing-booking',
    label: 'Completing a booking',
    icon: 'ri-check-double-line',
    prompt: 'What happens after I select guards? Walk me through the booking confirmation process.',
  },
  {
    id: 'upgrading',
    label: 'Upgrading my plan',
    icon: 'ri-arrow-up-circle-line',
    prompt: 'What plans does QuickGuard offer? Which plan is right for my business and how do I upgrade?',
  },
];

export default function ClientOnboardingAgent({
  clientId,
  hasJobs,
  isFreeOrStarter,
  profileCompleted,
  page,
}: ClientOnboardingAgentProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const shouldShow = !dismissed && profileCompleted && isFreeOrStarter;

  const handleOpenAgent = async (topic?: HelpTopic) => {
    try {
      const widget = document.querySelector('#vapi-widget-floating-button') as HTMLElement;
      if (widget) widget.click();
    } catch {}

    logClientActivity({
      action_type: 'client_onboarding_agent_opened',
      action_description: topic
        ? `Opened onboarding agent on ${page}: ${topic.label}`
        : `Opened onboarding agent on ${page}`,
      category: ACTIVITY_CATEGORIES.ACCOUNT,
      metadata: {
        page,
        topic_id: topic?.id || null,
        topic_label: topic?.label || null,
        has_jobs: hasJobs,
      },
    }).catch(() => {});
  };

  if (!shouldShow) return null;

  if (page === 'onboarding') {
    return (
      <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/20 flex-shrink-0">
              <i className="ri-robot-line text-teal-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Need help getting started?</h3>
              <p className="text-sm text-slate-400">Ask QuickGuard Assistant — I can guide you through posting your first job, selecting guards, and more.</p>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => handleOpenAgent()}
              className="px-5 py-2.5 bg-teal-500 text-slate-900 rounded-xl font-medium text-sm hover:bg-teal-400 transition whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-robot-line w-4 h-4 flex items-center justify-center"></i>
              Ask QuickGuard Assistant
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'post-job') {
    return (
      <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 rounded-2xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-10 h-10 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/20 flex-shrink-0">
            <i className="ri-robot-line text-teal-400 text-lg w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-white font-semibold text-sm mb-1">Stuck on any step?</p>
            <p className="text-slate-400 text-xs">Ask QuickGuard Assistant for help with your job post</p>
          </div>
          <button
            onClick={() => handleOpenAgent()}
            className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg font-medium text-sm hover:bg-teal-400 transition whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <i className="ri-robot-line w-4 h-4 flex items-center justify-center"></i>
            Get Help
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-teal-500/5 to-emerald-500/5 border border-teal-500/15 rounded-2xl overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-500/15 rounded-xl flex items-center justify-center border border-teal-500/20">
              <i className="ri-robot-line text-teal-400 text-xl w-6 h-6 flex items-center justify-center"></i>
            </div>
            <div>
              <h3 className="text-white font-semibold">Need help setting up your first job?</h3>
              <p className="text-sm text-slate-400 mt-0.5">Ask QuickGuard Assistant — I&apos;m here to guide you</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title={expanded ? 'Show less' : 'Show topics'}
            >
              <i className={expanded ? 'ri-arrow-up-s-line text-lg' : 'ri-question-line text-lg'}></i>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        <button
          onClick={() => handleOpenAgent()}
          className="w-full px-4 py-2.5 bg-teal-500 text-slate-900 rounded-xl font-semibold text-sm hover:bg-teal-400 transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 mb-3"
        >
          <i className="ri-robot-line w-4 h-4 flex items-center justify-center"></i>
          Ask QuickGuard Assistant
        </button>

        {expanded && (
          <div className="grid grid-cols-2 gap-2">
            {HELP_TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleOpenAgent(topic)}
                className="flex items-center gap-2 px-3 py-2 bg-[#162036] border border-[#1e2d4d] rounded-lg text-left hover:border-teal-500/30 hover:bg-teal-500/5 transition cursor-pointer group"
              >
                <div className="w-7 h-7 bg-teal-500/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/20 transition">
                  <i className={`${topic.icon} text-teal-400 text-sm w-4 h-4 flex items-center justify-center`}></i>
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white transition leading-tight">
                  {topic.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}