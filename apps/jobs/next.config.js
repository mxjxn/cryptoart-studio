/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cryptoart/chain-indexer', '@cryptoart/db'],
  experimental: {
    serverComponentsExternalPackages: ['postgres', 'drizzle-orm'],
  },
};

export default nextConfig;
