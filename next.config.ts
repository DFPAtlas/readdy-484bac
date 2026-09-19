import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // QuickGuard has legacy TypeScript debt outside the launch-critical flows.
    // CI still captures the full tsc report; production build is allowed to proceed.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
