#!/bin/bash

# Script to test Vercel build locally
# This runs the same commands that Vercel runs

set -e

echo "🧪 Testing Vercel build locally..."
echo ""

# Get the repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "📦 Step 1: Converting workspace dependencies..."
node scripts/convert-workspace-deps.js

echo ""
echo "📦 Step 2: Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "🔨 Step 3: Building workspace dependencies..."
cd packages/unified-indexer
npm run build
cd "$REPO_ROOT"

echo ""
echo "🔨 Step 4: Building Next.js app..."
cd apps/cryptoart-studio-app
npm run build

echo ""
echo "✅ Build test completed successfully!"
echo "If you see this message, your build should work on Vercel."

