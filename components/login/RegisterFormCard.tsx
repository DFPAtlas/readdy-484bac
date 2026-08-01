"use client";

import { ReactNode } from "react";

interface RegisterFormCardProps {
  children: ReactNode;
  userTypeLabel: string;
  formId: string;
  heading?: string;
  subtitle?: string;
}

export default function RegisterFormCard({ children, userTypeLabel, formId, heading = "Create your account", subtitle = "Join thousands of professionals on the QuickGuard platform." }: RegisterFormCardProps) {
  return (
    <div className="relative z-10 w-full max-w-[440px]">
      <div
        className="rounded-[20px] border p-8 md:p-10"
        style={{
          background: "rgba(14,27,46,0.85)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex flex-col items-center mb-6">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-5"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.18)" }}
          >
            <i className="ri-user-add-line mr-1.5 text-xs" />
            {userTypeLabel}
          </span>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "#10B981", color: "#fff" }}
              >
                1
              </div>
              <span className="text-xs font-medium text-white">Register</span>
            </div>
            <div className="w-8 h-px bg-[rgba(255,255,255,0.12)]" />
            <div className="flex items-center gap-2 opacity-40">
              <div
                className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold border"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#AAB7C4" }}
              >
                2
              </div>
              <span className="text-xs font-medium text-[#AAB7C4]">Dashboard</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white text-center">
            {heading}
          </h2>
          <p className="text-sm text-[#AAB7C4] text-center mt-1.5">
            {subtitle}
          </p>
        </div>

        <div id={formId}>
          {children}
        </div>
      </div>
    </div>
  );
}