import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aumentar limite de upload para Server Actions (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
