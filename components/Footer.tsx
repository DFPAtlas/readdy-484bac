import Link from 'next/link';
import FooterExitPopupTestIcon from '@/components/qg-rewards/FooterExitPopupTestIcon';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-[#0B1933] text-white pt-16 pb-8" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 mb-12">
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-4">
              <img
                src="https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp"
                alt="QuickGuard"
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-2xl font-bold font-[family-name:var(--font-pacifico)] text-white">QuickGuard</span>
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed text-sm">
              The UK's leading platform connecting SIA-licensed security professionals with businesses nationwide. Trusted, verified, and available 24/7.
            </p>
            <p className="text-slate-500 text-sm mb-2">© {currentYear} QuickGuard. All rights reserved.</p>
          </div>

          <nav aria-label="Hire security">
            <h3 className="text-lg font-bold mb-4 text-white">Hire Security</h3>
            <ul className="space-y-3 list-none m-0 p-0">
              <li>
                <Link href="/client/register" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Post a Job
                </Link>
              </li>
              <li>
                <Link href="/find-a-guard" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Find a Guard
                </Link>
              </li>
              <li>
                <Link href="/how-it-works/clients" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  How It Works for Clients
                </Link>
              </li>
              <li>
                <Link href="/security-for-nightclubs" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Nightclub Security
                </Link>
              </li>
              <li>
                <Link href="/security-for-shops" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Retail Security
                </Link>
              </li>
              <li>
                <Link href="/security-for-building-sites" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Construction Security
                </Link>
              </li>
              <li>
                <Link href="/security-for-events" prefetch={false} className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm">
                  Event Security
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Platform links">
            <h3 className="text-lg font-bold mb-4 text-white">Platform</h3>
            <ul className="space-y-3 list-none m-0 p-0">
              <li>
                <Link
                  href="/how-it-works"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Browse Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/guard/register"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Become a Guard
                </Link>
              </li>
              <li>
                <Link
                  href="/client/register"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Post a Job
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Locations">
            <h3 className="text-lg font-bold mb-4 text-white">Locations</h3>
            <ul className="space-y-3 list-none m-0 p-0">
              <li>
                <Link
                  href="/security-guards/london"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards London
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/manchester"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Manchester
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/birmingham"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Birmingham
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/leeds"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Leeds
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/liverpool"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Liverpool
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/glasgow"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Glasgow
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/edinburgh"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Edinburgh
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/bristol"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Bristol
                </Link>
              </li>
              <li>
                <Link
                  href="/security-guards/cardiff"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Security Guards Cardiff
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Resources">
            <h3 className="text-lg font-bold mb-4 text-white">Resources</h3>
            <ul className="space-y-3 list-none m-0 p-0">
              <li>
                <Link
                  href="/help"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/guide/guard"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Guard Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/guide/client"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Client Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/accessibility"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Accessibility
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h3 className="text-lg font-bold mb-4 text-white">Legal</h3>
            <ul className="space-y-3 list-none m-0 p-0">
              <li>
                <Link
                  href="/terms"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@quickguard.uk"
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Report Issue
                </a>
              </li>
              <li>
                <Link
                  href="/accessibility-feedback"
                  prefetch={false}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none focus:underline text-sm"
                >
                  Accessibility Feedback
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Contact</h3>
            <ul className="space-y-3 list-none m-0 p-0 mb-6">
              <li>
                <a
                  href="mailto:info@quickguard.uk"
                  className="text-slate-400 hover:text-teal-400 transition-colors focus:outline-none focus:underline text-sm flex items-start gap-2"
                >
                  <i className="ri-mail-line text-lg mt-0.5 text-teal-400" aria-hidden="true"></i>
                  <span>info@quickguard.uk</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:01992217019"
                  className="text-slate-400 hover:text-teal-400 transition-colors focus:outline-none focus:underline text-sm flex items-start gap-2"
                >
                  <i className="ri-phone-line text-lg mt-0.5 text-teal-400" aria-hidden="true"></i>
                  <span>01992 217019</span>
                </a>
              </li>
              <li className="text-slate-400 text-sm flex items-start gap-2">
                <i className="ri-time-line text-lg mt-0.5 text-teal-400" aria-hidden="true"></i>
                <div>
                  <p>Mon-Fri: 9:00 AM - 6:00 PM</p>
                  <p>Sat-Sun: 10:00 AM - 4:00 PM</p>
                </div>
              </li>
            </ul>

            <div>
              <p className="text-sm font-medium text-slate-300 mb-3">Follow Us</p>
              <ul className="flex space-x-3 list-none m-0 p-0" aria-label="Social media links">
                <li>
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-[#111d35] border border-slate-700/50 rounded-lg flex items-center justify-center hover:bg-teal-500 hover:text-slate-900 hover:border-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0B1933]"
                    aria-label="Visit our Facebook page"
                  >
                    <i className="ri-facebook-fill text-xl" aria-hidden="true"></i>
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-[#111d35] border border-slate-700/50 rounded-lg flex items-center justify-center hover:bg-teal-500 hover:text-slate-900 hover:border-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0B1933]"
                    aria-label="Visit our Twitter page"
                  >
                    <i className="ri-twitter-fill text-xl" aria-hidden="true"></i>
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-[#111d35] border border-slate-700/50 rounded-lg flex items-center justify-center hover:bg-teal-500 hover:text-slate-900 hover:border-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0B1933]"
                    aria-label="Visit our LinkedIn page"
                  >
                    <i className="ri-linkedin-fill text-xl" aria-hidden="true"></i>
                  </a>
                </li>
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-[#111d35] border border-slate-700/50 rounded-lg flex items-center justify-center hover:bg-teal-500 hover:text-slate-900 hover:border-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-[#0B1933]"
                    aria-label="Visit our Instagram page"
                  >
                    <i className="ri-instagram-fill text-xl" aria-hidden="true"></i>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-xs">
              QuickGuard is a registered trademark. All security guards are independently verified and SIA licensed.
            </p>
            <nav aria-label="Additional links">
              <ul className="flex items-center flex-wrap justify-center gap-4 list-none m-0 p-0">
                <li>
                  <FooterExitPopupTestIcon />
                </li>
                <li>
                  <Link
                    href="/admin/login"
                    prefetch={false}
                    className="text-slate-500 hover:text-teal-400 text-xs transition-colors focus:outline-none focus:underline"
                  >
                    Admin
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
