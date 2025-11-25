import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize for performance
  experimental: {
    optimizePackageImports: ['@farcaster/miniapp-sdk', 'lucide-react', '@radix-ui/react-select', '@radix-ui/react-checkbox'],
  },
  
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Optimize bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Fix for ESM .js extensions in TypeScript imports
    // Next.js/webpack needs to resolve .js imports in TypeScript to .ts files
    // This allows us to keep .js extensions in source for Node.js ESM compatibility
    // Webpack 5.74+ supports extensionAlias
    if (!config.resolve.extensionAlias) {
      config.resolve.extensionAlias = {};
    }
    // When a .js file is imported, try .ts first (for TypeScript source files)
    config.resolve.extensionAlias['.js'] = ['.ts', '.tsx', '.js'];
    
    return config;
  },
  
  // Output file tracing root for monorepo
  // For Vercel/Turborepo: uses process.cwd() which will be the monorepo root
  // This ensures proper workspace package resolution
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACING_ROOT || process.cwd(),
  
  // Disable ESLint during build (warnings won't fail build)
  // TODO: Fix ESLint warnings and re-enable
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
