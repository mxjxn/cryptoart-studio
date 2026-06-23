import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cryptoart/db', '@pigment-css/react'],
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
