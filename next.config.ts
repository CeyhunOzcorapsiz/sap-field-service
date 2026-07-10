import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SAP Service Layer self-signed SSL sertifikasi icin
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
