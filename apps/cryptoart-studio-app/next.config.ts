import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
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
    // When TypeScript files import with .js extension, webpack should resolve to .ts files
    // This is needed because we use .js extensions in source for Node.js ESM compatibility
    config.resolve.extensions = [
      '.ts',
      '.tsx', 
      '.js',
      '.jsx',
      '.mjs',
      '.mts',
      '.json',
      ...(config.resolve.extensions || []),
    ];
    
    // Configure module resolution to try .ts before .js
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    
    return config;
  },
  
  // Output file tracing root to fix workspace warning
  // In Docker, this will be /app, locally it can be your project root
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACING_ROOT || process.cwd(),
  
  // Disable ESLint during build (warnings won't fail build)
  // TODO: Fix ESLint warnings and re-enable
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
