import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three ships ESM examples; let Next transpile it for the browser bundle
  transpilePackages: ["three"],
};

export default nextConfig;
