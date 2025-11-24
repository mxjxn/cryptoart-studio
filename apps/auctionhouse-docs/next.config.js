/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages base path (subdirectory under cryptoart-studio)
  basePath: '/cryptoart-studio/auctionhouse',
  trailingSlash: true,
}

module.exports = nextConfig

