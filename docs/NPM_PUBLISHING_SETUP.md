# NPM Publishing Setup for @lssvm/abis

This document explains how `@lssvm/abis` is published to npm and how the cryptoart-monorepo uses it.

## Overview

The `@lssvm/abis` package is published to npm from the `such-lssvm` monorepo. This eliminates the need for git dependencies and simplifies the build process on Vercel.

## Publishing @lssvm/abis

### Location
- **Repository**: `github.com/mxjxn/such-lssvm`
- **Package Directory**: `packages/lssvm-abis/`
- **npm Package**: `@lssvm/abis`

### Publishing Steps

1. **Navigate to the package**:
   ```bash
   cd lssvm2/packages/lssvm-abis
   ```

2. **Build the package**:
   ```bash
   npm run build
   ```

3. **Update version** (if needed):
   ```bash
   npm version patch  # 0.1.0 -> 0.1.1
   ```

4. **Publish to npm**:
   ```bash
   npm publish
   ```

   The `prepublishOnly` script will automatically:
   - Clean the dist directory
   - Build TypeScript files
   - Ensure everything is ready

5. **Verify publication**:
   ```bash
   npm view @lssvm/abis
   ```

See `lssvm2/packages/lssvm-abis/PUBLISHING.md` for detailed instructions.

## Using in cryptoart-monorepo

### Before (Git Dependency)
```json
{
  "dependencies": {
    "@lssvm/abis": "git+https://github.com/mxjxn/such-lssvm.git#main"
  }
}
```

**Problems:**
- Required custom scripts to handle `workspace:*` dependencies
- Complex Vercel build process
- npm doesn't support `workspace:*` protocol
- Build failures with "Invalid Version" errors

### After (npm Package)
```json
{
  "dependencies": {
    "@lssvm/abis": "^0.1.0"
  }
}
```

**Benefits:**
- Standard npm dependency
- No custom installation scripts needed
- Simpler Vercel builds
- Works with all package managers (npm, pnpm, yarn)

## Updating the Dependency

When a new version of `@lssvm/abis` is published:

1. **Update package.json**:
   ```bash
   cd cryptoart-monorepo
   npm install @lssvm/abis@latest
   # or manually update version in package.json
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Test the build**:
   ```bash
   npm run build
   ```

## Removed Scripts

The following scripts are no longer needed and can be removed:
- `scripts/install-with-git-deps.js` - Handled git dependency installation
- Parts of `scripts/convert-workspace-deps.js` that handled git deps

The `convert-workspace-deps.js` script is still needed for converting `workspace:*` dependencies to `file:` paths for npm compatibility.

## Troubleshooting

### "Package not found"
- Make sure `@lssvm/abis` has been published to npm
- Check that you're using the correct version number
- Verify npm registry access: `npm whoami`

### Build errors after updating
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that the published package version matches your dependency version
- Verify the package exports match what you're importing

