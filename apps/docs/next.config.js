/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages base path (repository name)
  basePath: '/cryptoart-studio',
  trailingSlash: true,
}

module.exports = nextConfig

