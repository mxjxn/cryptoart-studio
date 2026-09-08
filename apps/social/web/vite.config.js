import { defineConfig, loadEnv } from 'vite';
import { feedMiddleware } from './src/cryptoart/server';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import basicSsl from '@vitejs/plugin-basic-ssl';

const httpsEnabled = process.env.HTTPS === 'true';

export default defineConfig({
  plugins: [
    {
      name: 'cryptoart-feed',
      configureServer(server) { server.middlewares.use(feedMiddleware(loadEnv(server.config.mode, process.cwd(), '').NEYNAR_API_KEY || process.env.NEYNAR_API_KEY)); },
      configurePreviewServer(server) { server.middlewares.use(feedMiddleware(loadEnv(server.config.mode, process.cwd(), '').NEYNAR_API_KEY || process.env.NEYNAR_API_KEY)); },
    },
    react(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        stream: true,
        process: true,
      },
    }),
    ...(httpsEnabled ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  server: {
    https: httpsEnabled,
  },
  build: {
    sourcemap: 'hidden',
    // Match browserslist config: chrome >= 111, edge >= 111, firefox >= 128, safari >= 16.4
    // These browsers all support ES2020 features natively (classes, async/await, spread, etc.)
    target: ['chrome111', 'edge111', 'firefox128', 'safari16.4'],
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into separate chunks
          'vendor-viem': ['viem'],
          'vendor-wagmi': ['wagmi', '@wagmi/core', '@wagmi/connectors'],
          'vendor-solana': ['@solana/web3.js'],
          'vendor-privy': ['@privy-io/react-auth'],
          'vendor-draftjs': [
            'draft-js',
            '@draft-js-plugins/editor',
            '@draft-js-plugins/mention',
            '@draft-js-plugins/emoji',
            '@draft-js-plugins/linkify',
          ],
          'vendor-emoji': [
            'emoji-mart',
            '@emoji-mart/data',
            '@emoji-mart/react',
          ],
          'vendor-charts': ['recharts'],
        },
      },
      plugins: [],
    },
  },
});
