"use client";

import Link from "next/link";

const features = [
  "Admin Dashboard Analytics",
  "User Management & Verification",
  "Financial Reporting",
  "System Health Monitoring",
  "Security Audit Logging",
  "Real-Time Notifications",
];

const bgImage = "https://readdy.ai/api/search-image?query=Dark%20abstract%20futuristic%20security%20technology%20background%20with%20subtle%20deep%20navy%20blue%20and%20cyan%20glow%20accents%2C%20geometric%20mesh%20network%20pattern%2C%20soft%20light%20rays%20and%20particle%20effects%2C%20premium%20enterprise%20SaaS%20aesthetic%2C%20minimal%20and%20elegant%20with%20low%20contrast%2C%20perfect%20for%20dark%20mode%20login%20page%20overlay&width=1200&height=800&seq=1&orientation=landscape";

export default function AdminMarketingPanel() {
  return (
    <div className="relative hidden lg:flex w-1/2 flex-col justify-between overflow-hidden bg-[#071321] p-12">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,19,33,0.7) 0%, rgba(7,19,33,0.3) 40%, rgba(7,19,33,0.5) 70%, rgba(7,19,33,0.85) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 20% 40%, rgba(29,161,242,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(59,130,246,0.08) 0%, transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 cursor-pointer">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#1DA1F2]/15 border border-[#1DA1F2]/20">
            <i className="ri-shield-check-fill text-[#1DA1F2] text-lg" />
          </div>
          <span className="font-[family-name:var(--font-pacifico)] text-xl text-white">QuickGuard</span>
        </Link>
      </div>

      <div className="relative z-10 max-w-md">
        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
          QuickGuard{" "}
          <span className="text-[#1DA1F2]">Admin Portal</span>
        </h1>
        <p className="text-[#AAB7C4] text-lg mb-10">
          Secure administration access for platform management.
        </p>

        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center rounded-full bg-[#1DA1F2]/10 border border-[#1DA1F2]/20">
                <i className="ri-check-line text-[#1DA1F2] text-xs" />
              </div>
              <span className="text-[#AAB7C4] text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-xs text-[#AAB7C4]/60">
        <i className="ri-shield-check-fill text-[#1DA1F2]" />
        <span>Secure Admin Access &middot; 2FA Ready &middot; Audit Tracked</span>
      </div>
    </div>
  );
}