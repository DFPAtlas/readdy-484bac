import Link from 'next/link';
import type { Metadata } from 'next';
import AccessibilitySchema from './AccessibilitySchema';

export const metadata: Metadata = {
  title: 'Accessibility Statement | QuickGuard UK',
  description:
    'QuickGuard is committed to digital accessibility. Learn about our WCAG 2.1 AA compliance, assistive technology support, and accessibility features.',
};

export default function AccessibilityPage() {
  return (
    <>
      <AccessibilitySchema />
      <main className="min-h-screen bg-[#0B1933]">
        <div className="bg-[#0e1628] border-b border-slate-800/60 py-20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="w-16 h-16 bg-teal-500/10 border border-teal-400/20 rounded-2xl flex items-center justify-center mb-6">
              <i className="ri-wheelchair-line text-3xl text-teal-400" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Accessibility Statement</h1>
            <p className="text-xl text-slate-400">
              QuickGuard is committed to ensuring digital accessibility for all users
            </p>
            <p className="text-sm text-slate-500 mt-4">
              Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16">
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Our Commitment</h2>
            <p className="text-lg text-slate-400 mb-4">
              QuickGuard is committed to ensuring that our website and services are accessible to everyone, including people with disabilities. We believe that everyone should have equal access to our security guard booking platform, regardless of their abilities or the technologies they use.
            </p>
            <p className="text-lg text-slate-400">
              We are continuously working to improve the accessibility and usability of our website to ensure we provide equal access to all of our users.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Conformance Status</h2>
            <div className="bg-teal-500/10 border border-teal-400/20 p-6 mb-6 rounded-xl">
              <div className="flex items-start">
                <i className="ri-checkbox-circle-fill text-2xl text-teal-400 mr-3 mt-1" aria-hidden="true" />
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">WCAG 2.1 Level AA Compliant</h3>
                  <p className="text-slate-400">
                    The QuickGuard website conforms to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These guidelines explain how to make web content more accessible for people with disabilities.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-4">Additional Compliance</h3>
            <ul className="space-y-3">
              {[
                { icon: 'ri-check-line', color: 'text-teal-400', text: 'Section 508 - US Federal accessibility requirements' },
                { icon: 'ri-check-line', color: 'text-teal-400', text: 'EN 301 549 - European accessibility standard' },
                { icon: 'ri-check-line', color: 'text-teal-400', text: 'Equality Act 2010 - UK legal requirements' },
              ].map((item) => (
                <li key={item.text} className="flex items-start">
                  <i className={`${item.icon} text-xl ${item.color} mr-3 mt-1`} aria-hidden="true" />
                  <span className="text-slate-400"><strong className="text-slate-300">{item.text.split(' - ')[0]}</strong> - {item.text.split(' - ')[1]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Accessibility Features</h2>
            <p className="text-lg text-slate-400 mb-6">
              Our website includes the following accessibility features:
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: 'ri-keyboard-line', title: 'Keyboard Navigation', text: 'Full website functionality accessible via keyboard using Tab, Enter, Space, and Arrow keys' },
                { icon: 'ri-volume-up-line', title: 'Screen Reader Support', text: 'Compatible with NVDA, JAWS, VoiceOver, and other screen reading technologies' },
                { icon: 'ri-contrast-2-line', title: 'Color Contrast', text: 'All text meets WCAG AA standards with a minimum 4.5:1 contrast ratio' },
                { icon: 'ri-focus-3-line', title: 'Focus Indicators', text: 'Visible focus indicators on all interactive elements for keyboard navigation' },
                { icon: 'ri-text', title: 'Text Alternatives', text: 'All images, icons, and non-text content have descriptive alternative text' },
                { icon: 'ri-layout-line', title: 'Semantic HTML', text: 'Proper heading hierarchy and semantic markup for assistive technologies' },
                { icon: 'ri-skip-forward-line', title: 'Skip Links', text: 'Skip navigation links allow users to bypass repetitive content' },
                { icon: 'ri-smartphone-line', title: 'Responsive Design', text: 'Mobile-friendly design with touch targets meeting 44x44px minimum size' },
                { icon: 'ri-file-list-line', title: 'Form Labels', text: 'All form inputs properly labeled with clear instructions and error messages' },
                { icon: 'ri-notification-line', title: 'Live Regions', text: 'Dynamic content changes announced to screen reader users' },
                { icon: 'ri-zoom-in-line', title: 'Text Resizing', text: 'Content remains functional and readable when zoomed up to 200%' },
                { icon: 'ri-lock-line', title: 'Focus Trapping', text: 'Modal dialogs trap focus and return focus when closed' },
              ].map((feature) => (
                <div key={feature.title} className="bg-[#111d35] border border-slate-700/50 rounded-xl p-6">
                  <div className="flex items-center mb-3">
                    <i className={`${feature.icon} text-2xl text-teal-400 mr-3`} aria-hidden="true" />
                    <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                  </div>
                  <p className="text-slate-400">{feature.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Assistive Technologies</h2>
            <p className="text-lg text-slate-400 mb-6">
              QuickGuard is designed to be compatible with the following assistive technologies:
            </p>
            <ul className="space-y-3">
              {[
                { icon: 'ri-arrow-right-s-line', text: 'Screen Readers: NVDA, JAWS, VoiceOver, TalkBack, Narrator' },
                { icon: 'ri-arrow-right-s-line', text: 'Speech Recognition: Dragon NaturallySpeaking, Windows Speech Recognition' },
                { icon: 'ri-arrow-right-s-line', text: 'Screen Magnifiers: ZoomText, MAGic, Windows Magnifier' },
                { icon: 'ri-arrow-right-s-line', text: 'Alternative Input Devices: Switch controls, eye tracking, mouth sticks' },
              ].map((item) => (
                <li key={item.text} className="flex items-start">
                  <i className={`${item.icon} text-xl text-teal-400 mr-2 mt-1`} aria-hidden="true" />
                  <span className="text-slate-400"><strong className="text-slate-300">{item.text.split(':')[0]}:</strong>{item.text.split(':')[1]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Testing and Evaluation</h2>
            <p className="text-lg text-slate-400 mb-6">
              We regularly test our website using:
            </p>
            <ul className="space-y-3">
              {[
                { icon: 'ri-checkbox-circle-line', text: 'Automated Testing: axe DevTools, WAVE, Lighthouse accessibility audits' },
                { icon: 'ri-checkbox-circle-line', text: 'Manual Testing: Keyboard navigation, screen reader testing, color contrast verification' },
                { icon: 'ri-checkbox-circle-line', text: 'User Testing: Feedback from users with disabilities and assistive technology users' },
              ].map((item) => (
                <li key={item.text} className="flex items-start">
                  <i className={`${item.icon} text-xl text-teal-400 mr-2 mt-1`} aria-hidden="true" />
                  <span className="text-slate-400"><strong className="text-slate-300">{item.text.split(':')[0]}:</strong>{item.text.split(':')[1]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Known Limitations</h2>
            <p className="text-lg text-slate-400 mb-6">
              Despite our best efforts, there may be some limitations. We are aware of the following:
            </p>
            <ul className="space-y-3">
              {[
                { icon: 'ri-information-line', text: 'Third-party content (such as embedded maps or payment processors) may not be fully under our control' },
                { icon: 'ri-information-line', text: 'User-generated content may not always meet accessibility standards' },
              ].map((item) => (
                <li key={item.text} className="flex items-start">
                  <i className={`${item.icon} text-xl text-amber-400 mr-2 mt-1`} aria-hidden="true" />
                  <span className="text-slate-400">{item.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-slate-400 mt-4">
              We are actively working to address these limitations and improve accessibility across all aspects of our platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Feedback and Contact</h2>
            <p className="text-lg text-slate-400 mb-6">
              We welcome your feedback on the accessibility of QuickGuard. If you encounter any accessibility barriers or have suggestions for improvement, please contact us:
            </p>

            <div className="bg-[#111d35] border border-slate-700/50 rounded-xl p-8">
              <h3 className="text-xl font-bold text-white mb-4">Get in Touch</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <i className="ri-mail-line text-xl text-teal-400 mr-3 mt-1" aria-hidden="true" />
                  <div>
                    <strong className="text-slate-300">Email:</strong>
                    <a href="mailto:accessibility@quickguard.uk" className="text-teal-400 hover:text-teal-300 ml-2 underline">accessibility@quickguard.uk</a>
                  </div>
                </li>
                <li className="flex items-start">
                  <i className="ri-phone-line text-xl text-teal-400 mr-3 mt-1" aria-hidden="true" />
                  <div>
                    <strong className="text-slate-300">Phone:</strong>
                    <span className="text-teal-400 ml-2">01992 217019</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <i className="ri-time-line text-xl text-teal-400 mr-3 mt-1" aria-hidden="true" />
                  <div>
                    <strong className="text-slate-300">Response Time:</strong>
                    <span className="text-slate-400 ml-2">We aim to respond to accessibility feedback within 2 business days</span>
                  </div>
                </li>
              </ul>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <Link
                  href="/accessibility-feedback"
                  className="inline-flex items-center justify-center bg-teal-500 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-teal-400 transition-all whitespace-nowrap shadow-lg hover:shadow-teal-500/20"
                >
                  <i className="ri-feedback-line w-5 h-5 flex items-center justify-center mr-2" aria-hidden="true" />
                  Report Accessibility Issue
                </Link>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Formal Complaints</h2>
            <p className="text-lg text-slate-400 mb-4">
              If you are not satisfied with our response to your accessibility concerns, you may contact:
            </p>
            <ul className="space-y-3">
              {[
                { title: 'Equality and Human Rights Commission (EHRC)', website: 'https://www.equalityhumanrights.com/' },
                { title: 'Equality Advisory and Support Service (EASS)', website: 'https://www.equalityadvisoryservice.com/', phone: '0808 800 0082' },
              ].map((item) => (
                <li key={item.title} className="flex items-start">
                  <i className="ri-arrow-right-s-line text-xl text-teal-400 mr-2 mt-1" aria-hidden="true" />
                  <div>
                    <strong className="text-slate-300">{item.title}</strong>
                    {item.phone && <p className="text-slate-400 mt-1">Phone: {item.phone}</p>}
                    <p className="text-slate-400 mt-1">
                      Website: <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 underline">{item.website}</a>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Technical Specifications</h2>
            <p className="text-lg text-slate-400 mb-4">
              The accessibility of QuickGuard relies on the following technologies:
            </p>
            <ul className="space-y-2">
              {['HTML5', 'CSS3', 'JavaScript (ES6+)', 'WAI-ARIA 1.2'].map((tech) => (
                <li key={tech} className="flex items-start">
                  <i className="ri-code-line text-xl text-teal-400 mr-2 mt-1" aria-hidden="true" />
                  <span className="text-slate-400">{tech}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6">Continuous Improvement</h2>
            <p className="text-lg text-slate-400 mb-4">
              Accessibility is an ongoing effort. We are committed to:
            </p>
            <ul className="space-y-3">
              {[
                'Regularly reviewing and testing our website for accessibility issues',
                'Training our team on accessibility best practices',
                'Incorporating accessibility into our design and development processes',
                'Staying up-to-date with accessibility standards and best practices',
                'Listening to feedback from users with disabilities',
              ].map((item) => (
                <li key={item} className="flex items-start">
                  <i className="ri-refresh-line text-xl text-teal-400 mr-2 mt-1" aria-hidden="true" />
                  <span className="text-slate-400">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-[#0e1628] border border-slate-700/50 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Our Promise</h2>
            <p className="text-lg text-slate-400">
              QuickGuard is dedicated to providing an inclusive experience for all users. We believe that accessibility is not just about compliance—it's about creating a better experience for everyone. We will continue to work towards making our platform accessible to all, and we appreciate your patience and feedback as we strive for continuous improvement.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}