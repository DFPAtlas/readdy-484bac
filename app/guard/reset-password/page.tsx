"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import LoginMarketingPanel from "@/components/login/LoginMarketingPanel";
import LoginFormCard from "@/components/login/LoginFormCard";

const mobileBg = "https://readdy.ai/api/search-image?query=Dark%20abstract%20futuristic%20security%20technology%20background%20with%20deep%20navy%20blue%20tones%2C%20subtle%20cyan%20geometric%20mesh%20network%20pattern%2C%20soft%20light%20rays%20and%20particle%20effects%2C%20premium%20enterprise%20SaaS%20aesthetic%2C%20minimal%20elegant%20low%20contrast%20style%2C%20perfect%20for%20dark%20mode%20mobile%20login%20page%20background%20overlay&width=800&height=1200&seq=6&orientation=portrait";

function ResetPasswordFormContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const hasExchanged = useRef(false);
  const hasHashHandled = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const setupSession = async () => {
      try {
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error_description");

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          setSessionLoading(false);
          return;
        }

        if (!hasHashHandled.current && typeof window !== "undefined") {
          const hash = window.location.hash;
          if (hash && (hash.includes("access_token=") || hash.includes("error="))) {
            hasHashHandled.current = true;
            const hashParams = new URLSearchParams(hash.replace("#", ""));
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");
            const hashError = hashParams.get("error_description");

            if (hashError) {
              setError(decodeURIComponent(hashError));
              setSessionLoading(false);
              return;
            }

            if (accessToken) {
              const { data: setData, error: setError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || "",
              });
              if (setData?.session) {
                window.history.replaceState({}, document.title, window.location.pathname);
                setSessionLoading(false);
                return;
              }
              if (setError) {
                setError(setError.message);
                setSessionLoading(false);
                return;
              }
            }
          }
        }

        if (code && !hasExchanged.current) {
          hasExchanged.current = true;
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            setSessionLoading(false);
            return;
          }
          if (data?.session) {
            setSessionLoading(false);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionLoading(false);
          return;
        }

        supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") {
            setSessionLoading(false);
          }
        });

        setError("Invalid or expired reset link. Please request a new one.");
        setSessionLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to verify reset link.");
        setSessionLoading(false);
      }
    };

    setupSession();
  }, [searchParams]);

  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"];
  const strength = getStrength();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    const { data: userData } = await supabase.auth.getUser();
    const role = userData?.user?.user_metadata?.role;

    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("new password should be different from the old password")) {
        setError("Your new password must be different from your current password. Please choose a different one.");
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }
    setSuccess(true);
    if (role === "admin") {
      setTimeout(() => router.push("/admin/login"), 2000);
    } else {
      setTimeout(() => router.push("/guard/login"), 2000);
    }
  };

  if (sessionLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 border-4 border-[rgba(255,255,255,0.08)] border-t-[#1DA1F2] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#AAB7C4] text-sm">Verifying your reset link...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-3">
          <i className="ri-check-line text-emerald-400 text-xl" />
        </div>
        <p className="text-emerald-400 font-semibold">Password updated! Redirecting...</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          className="rounded-xl border p-3 mb-4"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
        >
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-error-warning-line text-red-400 text-sm" />
            </div>
            <div>
              <p className="text-xs font-medium text-red-300">{error}</p>
              <Link href="/guard/forgot-password" className="text-xs text-[#1DA1F2] hover:text-[#3B82F6] underline mt-1 inline-block">
                Request a new reset link
              </Link>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#AAB7C4] mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
              placeholder="Minimum 8 characters"
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
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`text-slate-400 hover:text-slate-300 text-sm ${showPassword ? "ri-eye-off-line" : "ri-eye-line"}`}></i>
              </div>
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all ${i <= strength ? strengthColors[strength] : "bg-slate-600"}`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Strength: <span className="font-medium">{strengthLabels[strength]}</span>
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[#AAB7C4] mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 pr-10 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
              placeholder="Repeat your new password"
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
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`text-slate-400 hover:text-slate-300 text-sm ${showConfirm ? "ri-eye-off-line" : "ri-eye-line"}`}></i>
              </div>
            </button>
          </div>
          {confirm.length > 0 && password !== confirm && (
            <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
              <i className="ri-close-circle-line"></i> Passwords do not match
            </p>
          )}
          {confirm.length > 0 && password === confirm && (
            <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
              <i className="ri-checkbox-circle-line"></i> Passwords match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap cursor-pointer"
          style={{ background: "linear-gradient(135deg, #1DA1F2, #3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(29,161,242,0.3)" }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

function RightPanel() {
  return (
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
          formId="guard-reset-password-form"
          heading="Set New Password"
          subtitle="Enter your new password below"
          showProgress={false}
        >
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-[rgba(255,255,255,0.08)] border-t-[#1DA1F2] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[#AAB7C4] text-sm">Loading...</p>
            </div>
          }>
            <ResetPasswordFormContent />
          </Suspense>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <Link
              href="/guard/login"
              className="text-sm text-[#1DA1F2] hover:text-[#3B82F6] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-sm"></i>
              Back to Login
            </Link>
          </div>
        </LoginFormCard>
      </div>
    </div>
  );
}

export default function GuardResetPasswordPage() {
  return (
    <div className="flex h-screen bg-[#071321] overflow-hidden">
      <LoginMarketingPanel />
      <RightPanel />
    </div>
  );
}