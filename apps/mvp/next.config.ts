import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile monorepo packages that use TypeScript
  transpilePackages: ['@cryptoart/db'],
  // Next.js 16 uses Turbopack by default - empty config silences the webpack warning
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix for Solana dependencies (bs58, basex) that are pulled in by Farcaster SDK
    // The "basex is not a function" error occurs because bs58 imports basex but
    // webpack doesn't handle the ESM/CommonJS interop correctly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
      
      // Ensure basex is properly resolved for bs58
      // This alias helps webpack find the correct module
      config.resolve.alias = {
        ...config.resolve.alias,
        'basex': 'base-x',
      };
    }
    
    // Mark @vercel/blob as external for server-side builds since it's only used conditionally
    if (isServer) {
      config.externals = config.externals || [];
      if (typeof config.externals === 'function') {
        const originalExternals = config.externals;
        config.externals = [
          originalExternals,
          ({ request }: { request?: string }) => {
            if (request === '@vercel/blob') {
              return `commonjs ${request}`;
            }
          },
        ];
      } else if (Array.isArray(config.externals)) {
        config.externals.push('@vercel/blob');
      }
    }
    
    return config;
  },
};

export default nextConfig;

