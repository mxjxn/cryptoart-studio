import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@cryptoart/db'],
  turbopack: {},
};

export default nextConfig;
