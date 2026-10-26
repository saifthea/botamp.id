import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cf.shopee.co.id",
      },
    ],
  },
  allowedDevOrigins: [
    "http://192.168.110.43:3000",
    "http://192.168.147.1:3000",
    "http://localhost:3000",
    "http://192.168.110.43",
    "http://192.168.147.1",
    "http://localhost",
  ],
};

export default nextConfig;