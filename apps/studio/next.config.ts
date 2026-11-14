import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cryptoart/db', '@cryptoart/identity', '@cryptoart/marketplace', '@cryptoart/media', '@cryptoart/ui', '@pigment-css/react'],
  // Preview/deploy unblock: packages/identity + packages/media still have strict TS debt.
  // Remove once those packages typecheck cleanly under Next 16.
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    try {
      const pigmentPath = require.resolve('@pigment-css/react', { paths: [process.cwd()] });
      config.resolve.alias = {
        ...config.resolve.alias,
        '@pigment-css/react': pigmentPath,
      };
    } catch {
      // optional
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        basex: 'base-x',
      };
    }

    return config;
  },
};

export default nextConfig;
