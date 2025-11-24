/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages base path
  basePath: '/cryptoart-auctionhouse',
  trailingSlash: true,
}

module.exports = nextConfig

