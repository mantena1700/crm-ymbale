import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone para Docker
  output: 'standalone',
  
  // Aumentar limite de upload para Server Actions (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // Ignorar erros de TypeScript durante o build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
