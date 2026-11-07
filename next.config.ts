import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // React 19 + Three.js canvas works smoother without double-mounting canvas contexts
  transpilePackages: ["three", "three-bvh-csg", "three-mesh-bvh"],
  webpack: (config) => {
    // Handle binary assets or worker if needed
    return config;
  },
};

export default nextConfig;
