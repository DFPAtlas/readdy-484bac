"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LoginMarketingPanel from "@/components/login/LoginMarketingPanel";
import LoginFormCard from "@/components/login/LoginFormCard";

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20abstract%20futuristic%20security%20technology%20background%20with%20deep%20navy%20blue%20tones%2C%20subtle%20cyan%20geometric%20mesh%20network%20pattern%2C%20soft%20light%20rays%20and%20particle%20effects%2C%20premium%20enterprise%20SaaS%20aesthetic%2C%20minimal%20elegant%20low%20contrast%20style%2C%20perfect%20for%20dark%20mode%20mobile%20login%20page%20background%20overlay&width=800&height=1200&seq=3&orientation=portrait";

export default function ClientForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email) {
      setErrorMessage("Please enter your email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setStatus("loading");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/client/reset-password`,
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else {
        setStatus("success");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("An error occurred. Please try again later.");
    }
  };

  const handleTryAgain = () => {
    setStatus("idle");
    setEmail("");
    setErrorMessage("");
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
            formId="client-forgot-password-form"
            heading="Reset Your Password"
            subtitle="Enter your email to receive password reset instructions"
            showProgress={false}
          >
            {status === "success" ? (
              <div className="space-y-5">
                <div
                  className="rounded-xl border p-4 flex items-start gap-3"
                  style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
                >
                  <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                    <i className="ri-checkbox-circle-fill text-xl text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-300 mb-1 text-sm">Email Sent Successfully</h3>
                    <p className="text-xs text-emerald-400/80">
                      We&apos;ve sent password reset instructions to <strong>{email}</strong>
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
                    What to do next
                  </h4>
                  <ul className="text-xs text-[#AAB7C4] space-y-1.5 ml-7">
                    <li className="list-disc">Check your email inbox</li>
                    <li className="list-disc">Click the reset link in the email</li>
                    <li className="list-disc">Create a new password</li>
                  </ul>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <p className="text-sm text-slate-300 font-medium mb-2">Didn&apos;t receive the email?</p>
                  <ul className="text-xs text-[#AAB7C4] space-y-1 ml-4">
                    <li className="list-disc">Check your spam or junk folder</li>
                    <li className="list-disc">Make sure you entered the correct email</li>
                    <li className="list-disc">Wait a few minutes and check again</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleTryAgain}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                    style={{ background: "linear-gradient(135deg, #1DA1F2, #3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(29,161,242,0.3)" }}
                  >
                    Try Another Email
                  </button>
                  <Link
                    href="/client/login"
                    className="w-full py-3 rounded-xl font-semibold text-sm text-center transition-colors whitespace-nowrap cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#AAB7C4", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMessage && (
                  <div
                    className="rounded-xl border p-3 flex items-center gap-2"
                    style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-error-warning-line text-red-400 text-sm" />
                    </div>
                    <p className="text-xs font-medium text-red-300">{errorMessage}</p>
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
                  disabled={status === "loading"}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #1DA1F2, #3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(29,161,242,0.3)" }}
                >
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Sending...
                    </span>
                  ) : (
                    "Send Reset Instructions"
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/client/login"
                    className="text-sm text-[#1DA1F2] hover:text-[#3B82F6] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-line text-sm"></i>
                    Back to Login
                  </Link>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t space-y-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-center">
                <p className="text-sm text-[#AAB7C4]">
                  Don&apos;t have an account?{" "}
                  <Link href="/client/register" className="text-[#1DA1F2] hover:text-[#3B82F6] font-semibold transition-colors">
                    Register as Client
                  </Link>
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-customer-service-2-line text-xs"></i>
                </div>
                <span>Need help?</span>
                <Link href="/contact" className="text-[#1DA1F2] hover:text-[#3B82F6] font-medium transition-colors">
                  24/7 Support
                </Link>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Are you a security guard?{" "}
                <Link href="/guard/forgot-password" className="text-[#1DA1F2] hover:text-[#3B82F6] font-semibold transition-colors">
                  Reset Guard Password
                </Link>
              </p>
            </div>
          </LoginFormCard>
        </div>
      </div>
    </div>
  );
}