#!/bin/bash
set -e

STUDIO_DIR="/Users/maxjackson/cryptoart/cryptoart-studio"
MONOREPO_DIR="/Users/maxjackson/cryptoart/cryptoart-monorepo"

echo "=== Merging cryptoart-studio into cryptoart-monorepo ==="

# Copy apps from cryptoart-studio
echo "Copying apps..."
cp -r "$STUDIO_DIR/apps/cryptoart-studio" "$MONOREPO_DIR/apps/auctionhouse" 2>/dev/null || echo "auctionhouse already exists or copy failed"
cp -r "$STUDIO_DIR/apps/cryptoart-studio-app" "$MONOREPO_DIR/apps/cryptoart-studio-app" 2>/dev/null || echo "cryptoart-studio-app already exists or copy failed"
cp -r "$STUDIO_DIR/apps/docs" "$MONOREPO_DIR/apps/docs" 2>/dev/null || echo "docs already exists or copy failed"
cp -r "$STUDIO_DIR/apps/web" "$MONOREPO_DIR/apps/web" 2>/dev/null || echo "web already exists or copy failed"

# Copy packages from cryptoart-studio
echo "Copying packages..."
cp -r "$STUDIO_DIR/packages/cache" "$MONOREPO_DIR/packages/" 2>/dev/null || echo "cache already exists"
cp -r "$STUDIO_DIR/packages/db" "$MONOREPO_DIR/packages/" 2>/dev/null || echo "db already exists"
cp -r "$STUDIO_DIR/packages/eslint-config" "$MONOREPO_DIR/packages/" 2>/dev/null || echo "eslint-config already exists"
cp -r "$STUDIO_DIR/packages/typescript-config" "$MONOREPO_DIR/packages/" 2>/dev/null || echo "typescript-config already exists"
cp -r "$STUDIO_DIR/packages/ui" "$MONOREPO_DIR/packages/" 2>/dev/null || echo "ui already exists"

# Remove node_modules and build artifacts
echo "Cleaning up..."
find "$MONOREPO_DIR/apps" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
find "$MONOREPO_DIR/apps" -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
find "$MONOREPO_DIR/packages" -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true

echo "=== Merge complete ==="
echo "Apps in monorepo:"
ls -la "$MONOREPO_DIR/apps/"
echo ""
echo "Packages in monorepo:"
ls -la "$MONOREPO_DIR/packages/"

