/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cryptoart/chain-indexer', '@cryptoart/db'],
  serverExternalPackages: ['postgres', 'drizzle-orm'],
};

export default nextConfig;
