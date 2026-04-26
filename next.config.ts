import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagsapi.com"
      }
    ]
  },
  devIndicators: false
};

export default nextConfig;
