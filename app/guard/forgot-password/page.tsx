"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LoginMarketingPanel from "@/components/login/LoginMarketingPanel";
import LoginFormCard from "@/components/login/LoginFormCard";

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20abstract%20futuristic%20security%20technology%20background%20with%20deep%20navy%20blue%20tones%2C%20subtle%20cyan%20geometric%20mesh%20network%20pattern%2C%20soft%20light%20rays%20and%20particle%20effects%2C%20premium%20enterprise%20SaaS%20aesthetic%2C%20minimal%20elegant%20low%20contrast%20style%2C%20perfect%20for%20dark%20mode%20mobile%20login%20page%20background%20overlay&width=800&height=1200&seq=4&orientation=portrait";

export default function GuardForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email address is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/guard/reset-password`,
      });

      if (error) {
        setError(error.message);
        setSubmitStatus("error");
      } else {
        setSubmitStatus("success");
        setEmail("");
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#071321] overflow-hidden">
      <LoginMarketingPanel />

      <div className="relative flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.06] lg:opacity-0"
          style={{ backgroundImage: `url(${mobileBg})` }}
        />
        <div
          className="pointer-events-none absolute inset-0 lg:opacity-0"
          style={{
            background: "linear-gradient(180deg, rgba(7,19,33,0.85) 0%, rgba(7,19,33,0.4) 50%, rgba(7,19,33,0.85) 100%)",
          }}
        />

        <div className="relative z-10 w-full flex flex-col items-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-8 lg:hidden cursor-pointer">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1DA1F2]/15 border border-[#1DA1F2]/20">
              <i className="ri-shield-check-fill text-[#1DA1F2] text-lg" />
            </div>
            <span className="font-[family-name:var(--font-pacifico)] text-xl text-white">QuickGuard</span>
          </Link>

          <LoginFormCard
            userTypeLabel="Password Reset"
            formId="guard-forgot-password-form"
            heading="Reset Your Password"
            subtitle="Enter your email to receive password reset instructions"
            showProgress={false}
          >
            {submitStatus === "success" ? (
              <div className="space-y-5">
                <div
                  className="rounded-xl border p-4 flex items-start gap-3"
                  style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
                >
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <i className="ri-mail-check-line text-xl text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-300 mb-1 text-sm">Check Your Email</h3>
                    <p className="text-xs text-emerald-400/80">
                      We&apos;ve sent password reset instructions to your email address. Please check your inbox and follow the link to reset your password.
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-information-line text-[#1DA1F2] text-sm" />
                    </div>
                    Didn&apos;t receive the email?
                  </h4>
                  <ul className="text-xs text-[#AAB7C4] space-y-1.5 ml-7">
                    <li className="list-disc">Check your spam or junk folder</li>
                    <li className="list-disc">Make sure you entered the correct email address</li>
                    <li className="list-disc">Wait a few minutes and check again</li>
                  </ul>
                </div>

                <button
                  onClick={() => setSubmitStatus("idle")}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #1DA1F2, #3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(29,161,242,0.3)" }}
                >
                  Try Another Email
                </button>

                <div className="text-center">
                  <Link
                    href="/guard/login"
                    className="text-sm text-[#1DA1F2] hover:text-[#3B82F6] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-line text-sm"></i>
                    Back to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div
                    className="rounded-xl border p-3 flex items-center gap-2"
                    style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-error-warning-line text-red-400 text-sm" />
                    </div>
                    <p className="text-xs font-medium text-red-300">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#AAB7C4] mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    placeholder="your@email.com"
                    required
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(29,161,242,0.5)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(29,161,242,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #1DA1F2, #3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(29,161,242,0.3)" }}
                >
                  {isSubmitting ? "Sending Instructions..." : "Send Reset Instructions"}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/guard/login"
                    className="text-sm text-[#1DA1F2] hover:text-[#3B82F6] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-line text-sm"></i>
                    Back to Login
                  </Link>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t space-y-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}>
                <h3 className="text-sm font-semibold text-white mb-3 text-center">Need Help?</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-customer-service-2-line text-[#1DA1F2] text-sm" />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-slate-200">Contact Support</h4>
                      <p className="text-xs text-slate-500">Our team is available 24/7 to help you</p>
                      <Link href="/contact" className="text-xs text-[#1DA1F2] hover:text-[#3B82F6] font-medium transition-colors">
                        Get in touch &rarr;
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-user-add-line text-[#1DA1F2] text-sm" />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-slate-200">New to QuickGuard?</h4>
                      <p className="text-xs text-slate-500">Create an account to start finding security work</p>
                      <Link href="/guard/register" className="text-xs text-[#1DA1F2] hover:text-[#3B82F6] font-medium transition-colors">
                        Register now &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Are you a client?{" "}
                <Link href="/client/forgot-password" className="text-[#1DA1F2] hover:text-[#3B82F6] font-medium transition-colors">
                  Client Password Reset
                </Link>
              </p>
            </div>
          </LoginFormCard>
        </div>
      </div>
    </div>
  );
}