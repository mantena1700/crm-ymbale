import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone para produção
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

  // Configurações de imagem
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Configuração webpack para módulos server-only
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Permitir módulos Node.js no servidor
      config.externals = config.externals || [];
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
