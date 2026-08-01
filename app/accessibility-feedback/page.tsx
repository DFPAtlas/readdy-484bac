'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const generateTicketId = () => {
  const prefix = 'ACC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

export default function AccessibilityFeedback() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    assistive_technology: '',
    issue_type: '',
    page_url: '',
    description: '',
    severity: '',
    browser: '',
    device: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [charCount, setCharCount] = useState(0);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'description') {
      setCharCount(value.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (charCount > 500) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    const newTicketId = generateTicketId();

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const browserDevice = [formData.browser, formData.device]
        .filter(Boolean)
        .join(' / ') || null;

      const { error: insertError } = await supabase
        .from('accessibility_feedback')
        .insert({
          ticket_id: newTicketId,
          user_id: userId,
          name: formData.name,
          email: formData.email,
          assistive_technology: formData.assistive_technology || null,
          issue_type: formData.issue_type,
          page_url: formData.page_url || null,
          description: formData.description,
          severity: formData.severity,
          browser_device: browserDevice,
          status: 'open'
        });

      if (insertError) {
        console.error('Database insert failed:', insertError);
        setSubmitStatus('error');
        setIsSubmitting(false);
        return;
      }

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-accessibility-feedback-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticket_id: newTicketId,
              name: formData.name,
              email: formData.email,
              assistive_technology: formData.assistive_technology,
              issue_type: formData.issue_type,
              severity: formData.severity,
              page_url: formData.page_url,
              browser: formData.browser,
              device: formData.device,
              description: formData.description,
              user_id: userId
            })
          }
        );
      } catch (emailErr) {
        console.error('Admin email failed:', emailErr);
      }

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-accessibility-feedback-confirmation`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticket_id: newTicketId,
              name: formData.name,
              email: formData.email,
              issue_type: formData.issue_type,
              severity: formData.severity,
              description: formData.description
            })
          }
        );
      } catch (confirmErr) {
        console.error('Confirmation email failed:', confirmErr);
      }

      setTicketId(newTicketId);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        assistive_technology: '',
        issue_type: '',
        page_url: '',
        description: '',
        severity: '',
        browser: '',
        device: ''
      });
      setCharCount(0);
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-black text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-2xl font-bold font-[family-name:var(--font-pacifico)]">
            QuickGuard
          </Link>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link 
            href="/accessibility" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4"
            aria-label="Back to Accessibility Statement"
          >
            <i className="ri-arrow-left-line w-5 h-5 flex items-center justify-center mr-2" aria-hidden="true"></i>
            Back to Accessibility Statement
          </Link>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Accessibility Feedback
          </h1>
          <p className="text-lg text-gray-700">
            We're committed to making QuickGuard accessible to everyone. If you've encountered any accessibility barriers while using our website, please let us know so we can address them.
          </p>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8" role="note">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="ri-information-line w-6 h-6 flex items-center justify-center text-blue-500" aria-hidden="true"></i>
            </div>
            <div className="ml-3">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">
                Your Feedback Matters
              </h2>
              <p className="text-blue-800">
                Your report helps us identify and fix accessibility issues. We aim to respond to all feedback within 2 business days.
              </p>
            </div>
          </div>
        </div>

        <form 
          id="accessibility-feedback-form"
          data-readdy-form
          onSubmit={handleSubmit} 
          className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm"
          aria-labelledby="form-title"
        >
          <h2 id="form-title" className="sr-only">Accessibility Issue Report Form</h2>

          {submitStatus === 'success' && (
            <div 
              className="mb-6 bg-green-50 border border-green-200 text-green-800 px-6 py-5 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center mb-3">
                <i className="ri-checkbox-circle-line w-6 h-6 flex items-center justify-center mr-2 text-green-600" aria-hidden="true"></i>
                <span className="font-semibold text-lg">Thank you for your feedback!</span>
              </div>
              <p className="mb-4">We've received your report and will review it shortly.</p>
              {ticketId && (
                <div className="bg-white border border-green-300 rounded-lg p-4">
                  <p className="text-sm text-green-700 mb-1">Your Reference Number:</p>
                  <p className="text-2xl font-bold text-green-900 font-mono tracking-wide">{ticketId}</p>
                  <p className="text-sm text-green-600 mt-2">
                    Please save this reference number. You can use it to track your submission or when contacting us.
                  </p>
                </div>
              )}
            </div>
          )}

          {submitStatus === 'error' && (
            <div 
              className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center">
                <i className="ri-error-warning-line w-5 h-5 flex items-center justify-center mr-2" aria-hidden="true"></i>
                <span className="font-semibold">Submission failed</span>
              </div>
              <p className="mt-1 text-sm">Please check your input and try again.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                Your Name <span className="text-red-600" aria-label="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address <span className="text-red-600" aria-label="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                aria-required="true"
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="assistive_technology" className="block text-sm font-semibold text-gray-900 mb-2">
              Assistive Technology Used
            </label>
            <select
              id="assistive_technology"
              name="assistive_technology"
              value={formData.assistive_technology}
              onChange={handleChange}
              className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer"
              aria-label="Select assistive technology you were using"
            >
              <option value="">Select technology (optional)</option>
              <option value="Screen Reader - NVDA">Screen Reader - NVDA</option>
              <option value="Screen Reader - JAWS">Screen Reader - JAWS</option>
              <option value="Screen Reader - VoiceOver">Screen Reader - VoiceOver</option>
              <option value="Screen Reader - TalkBack">Screen Reader - TalkBack</option>
              <option value="Screen Magnifier">Screen Magnifier</option>
              <option value="Speech Recognition">Speech Recognition</option>
              <option value="Keyboard Only">Keyboard Only</option>
              <option value="Switch Control">Switch Control</option>
              <option value="Other">Other</option>
              <option value="None">None</option>
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="issue_type" className="block text-sm font-semibold text-gray-900 mb-2">
              Type of Issue <span className="text-red-600" aria-label="required">*</span>
            </label>
            <select
              id="issue_type"
              name="issue_type"
              value={formData.issue_type}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer"
              aria-required="true"
              aria-label="Select the type of accessibility issue"
            >
              <option value="">Select issue type</option>
              <option value="Keyboard Navigation">Keyboard Navigation</option>
              <option value="Screen Reader">Screen Reader Compatibility</option>
              <option value="Color Contrast">Color Contrast</option>
              <option value="Focus Indicators">Focus Indicators</option>
              <option value="Form Labels">Form Labels/Instructions</option>
              <option value="Alternative Text">Missing Alternative Text</option>
              <option value="Heading Structure">Heading Structure</option>
              <option value="Link Text">Unclear Link Text</option>
              <option value="Video/Audio">Video/Audio Accessibility</option>
              <option value="Mobile Accessibility">Mobile Accessibility</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="severity" className="block text-sm font-semibold text-gray-900 mb-2">
              Severity Level <span className="text-red-600" aria-label="required">*</span>
            </label>
            <select
              id="severity"
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer"
              aria-required="true"
              aria-describedby="severity-help"
            >
              <option value="">Select severity</option>
              <option value="Critical">Critical - Cannot use the site</option>
              <option value="High">High - Major difficulty using the site</option>
              <option value="Medium">Medium - Some difficulty</option>
              <option value="Low">Low - Minor inconvenience</option>
            </select>
            <p id="severity-help" className="mt-2 text-sm text-gray-600">
              How much does this issue impact your ability to use the site?
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="page_url" className="block text-sm font-semibold text-gray-900 mb-2">
              Page URL Where Issue Occurred
            </label>
            <input
              type="url"
              id="page_url"
              name="page_url"
              value={formData.page_url}
              onChange={handleChange}
              placeholder="https://quickguard.uk/..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              aria-describedby="url-help"
            />
            <p id="url-help" className="mt-2 text-sm text-gray-600">
              Copy and paste the URL of the page where you encountered the issue
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="browser" className="block text-sm font-semibold text-gray-900 mb-2">
                Browser
              </label>
              <select
                id="browser"
                name="browser"
                value={formData.browser}
                onChange={handleChange}
                className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer"
                aria-label="Select browser you were using"
              >
                <option value="">Select browser (optional)</option>
                <option value="Chrome">Chrome</option>
                <option value="Firefox">Firefox</option>
                <option value="Safari">Safari</option>
                <option value="Edge">Edge</option>
                <option value="Opera">Opera</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="device" className="block text-sm font-semibold text-gray-900 mb-2">
                Device Type
              </label>
              <select
                id="device"
                name="device"
                value={formData.device}
                onChange={handleChange}
                className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none bg-white cursor-pointer"
                aria-label="Select device type you were using"
              >
                <option value="">Select device (optional)</option>
                <option value="Desktop">Desktop</option>
                <option value="Laptop">Laptop</option>
                <option value="Tablet">Tablet</option>
                <option value="Mobile Phone">Mobile Phone</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
              Description of Issue <span className="text-red-600" aria-label="required">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm resize-none"
              placeholder="Please describe the accessibility issue you encountered. Include what you were trying to do, what happened, and what you expected to happen."
              aria-required="true"
              aria-describedby="description-help char-count"
            ></textarea>
            <div className="flex justify-between items-center mt-2">
              <p id="description-help" className="text-sm text-gray-600">
                Be as specific as possible to help us identify and fix the issue
              </p>
              <p 
                id="char-count" 
                className={`text-sm ${charCount > 500 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}
                aria-live="polite"
              >
                {charCount}/500
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={isSubmitting || charCount > 500}
              className="flex-1 bg-teal-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-teal-700 focus:ring-4 focus:ring-teal-500/50 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              aria-label={isSubmitting ? 'Submitting feedback' : 'Submit accessibility feedback'}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2" aria-hidden="true">⏳</span>
                  Submitting...
                </span>
              ) : (
                'Submit Feedback'
              )}
            </button>
            <Link
              href="/accessibility"
              className="flex-1 bg-gray-200 text-gray-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-300 focus:ring-4 focus:ring-gray-400/50 transition-colors text-center whitespace-nowrap cursor-pointer"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Alternative Contact Methods
          </h2>
          <div className="space-y-3 text-gray-700">
            <p className="flex items-start">
              <i className="ri-mail-line w-5 h-5 flex items-center justify-center mr-3 mt-0.5 text-teal-600" aria-hidden="true"></i>
              <span>
                <strong>Email:</strong> <a href="mailto:accessibility@quickguard.uk" className="text-teal-600 hover:underline focus:underline">accessibility@quickguard.uk</a>
              </span>
            </p>
            <p className="flex items-start">
              <i className="ri-phone-line w-5 h-5 flex items-center justify-center mr-3 mt-0.5 text-teal-600" aria-hidden="true"></i>
              <span>
                <strong>Phone:</strong> <span className="text-teal-600">01992 217019</span>
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-4">
              We aim to respond to all accessibility feedback within 2 business days.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 QuickGuard. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
