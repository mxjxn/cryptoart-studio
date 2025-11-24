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
    
    return config;
  },
  
  // Output file tracing root to fix workspace warning
  // In Docker, this will be /app, locally it can be your project root
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACING_ROOT || process.cwd(),
  
  // Allow cross-origin requests for localtunnel
  allowedDevOrigins: ['*.loca.lt'],
};

export default nextConfig;
