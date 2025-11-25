# Migration from Git Dependency to npm Package

## Summary

The `@lssvm/abis` package has been migrated from a git dependency to a published npm package. This simplifies the build process and eliminates complex installation scripts.

## Changes Made

### 1. Package Configuration (`lssvm2/packages/lssvm-abis/package.json`)
- ✅ Removed `"private": true`
- ✅ Added `publishConfig` for public npm publishing
- ✅ Added `files` field to specify what gets published
- ✅ Added `prepublishOnly` script to build before publishing
- ✅ Added repository and keywords metadata

### 2. cryptoart-monorepo Updates

**package.json**:
```diff
- "@lssvm/abis": "git+https://github.com/mxjxn/such-lssvm.git#main"
+ "@lssvm/abis": "^0.1.0"
```

**vercel.json**:
```diff
- "installCommand": "cd ../.. && git config --global url.\"https://github.com/\".insteadOf \"git+ssh://git@github.com/\" && node scripts/convert-workspace-deps.js && node scripts/install-with-git-deps.js"
+ "installCommand": "cd ../.. && node scripts/convert-workspace-deps.js && npm install --legacy-peer-deps"
```

### 3. Scripts Status

- ✅ `scripts/convert-workspace-deps.js` - **Still needed** (converts `workspace:*` to `file:` for npm)
- ⚠️ `scripts/install-with-git-deps.js` - **No longer needed** (can be removed or kept as backup)

## Next Steps

### 1. Publish @lssvm/abis to npm

```bash
cd lssvm2/packages/lssvm-abis
npm run build
npm publish
```

See `lssvm2/packages/lssvm-abis/PUBLISHING.md` for detailed instructions.

### 2. Update cryptoart-monorepo

After publishing, install the npm package:

```bash
cd cryptoart-monorepo
npm install
# or
pnpm install
```

### 3. Test the Build

```bash
# Test locally
npm run build

# Test Vercel build (push to trigger deployment)
git add .
git commit -m "Migrate @lssvm/abis to npm package"
git push
```

### 4. Clean Up (Optional)

Once everything is working, you can optionally remove:
- `scripts/install-with-git-deps.js` (no longer needed)
- `.temp-git-deps/` directory (if it exists)

## Benefits

1. **Simpler Builds**: No more complex git dependency handling
2. **Faster Installs**: npm packages are cached and faster than git clones
3. **Better Compatibility**: Works with all package managers (npm, pnpm, yarn)
4. **Version Management**: Standard semantic versioning
5. **Vercel Compatibility**: No more "Invalid Version" errors

## Rollback Plan

If you need to rollback to git dependency:

1. Revert `package.json`:
   ```json
   "@lssvm/abis": "git+https://github.com/mxjxn/such-lssvm.git#main"
   ```

2. Revert `vercel.json`:
   ```json
   "installCommand": "cd ../.. && git config --global url.\"https://github.com/\".insteadOf \"git+ssh://git@github.com/\" && node scripts/convert-workspace-deps.js && node scripts/install-with-git-deps.js"
   ```

3. Restore `scripts/install-with-git-deps.js` if it was deleted

## Troubleshooting

### "Package @lssvm/abis not found"
- Make sure the package has been published: `npm view @lssvm/abis`
- Check that you're logged into npm: `npm whoami`
- Verify the version number matches what's published

### Build still fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Check that `convert-workspace-deps.js` is still running correctly
- Verify workspace dependencies are being converted properly

