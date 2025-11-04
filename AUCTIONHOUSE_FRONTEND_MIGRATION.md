# Manual Instructions: Moving Auctionhouse Frontend

## Overview

The auctionhouse frontend needs to be moved into the monorepo at `apps/auctionhouse/`. This document provides step-by-step instructions for locating and moving the frontend application.

## Prerequisites

- Locate the auctionhouse frontend repository/project
- Ensure you have access to the source code
- Verify the project structure before moving

## Step 1: Locate the Auctionhouse Frontend

The auctionhouse frontend is likely:
- A separate GitHub repository
- Located in a different directory structure
- Named something like `auctionhouse-frontend`, `auctionhouse-app`, or similar

**Action Items:**
1. Find the repository or directory containing the auctionhouse frontend code
2. Verify it's a Next.js/React application (should have `package.json`, `next.config.*`, etc.)
3. Note the current location/path

## Step 2: Prepare for Migration

Before moving, check for:

- **Dependencies**: Review `package.json` for any monorepo-specific dependencies
- **Environment Variables**: Note any `.env` files or environment variable requirements
- **Configuration Files**: 
  - `next.config.*`
  - `tsconfig.json`
  - `tailwind.config.*`
  - Any build/deployment configs
- **Git History**: Decide if you want to preserve git history (see git migration guide)

## Step 3: Move to Monorepo

### Option A: Copy Fresh (No Git History)

```bash
# From the monorepo root
cd /Users/maxjackson/cryptoart/cryptoart-monorepo

# Copy the auctionhouse frontend to apps/auctionhouse
cp -r <path-to-auctionhouse-frontend> apps/auctionhouse

# Clean up node_modules and build artifacts
cd apps/auctionhouse
rm -rf node_modules .next .turbo
```

### Option B: Preserve Git History (Advanced)

If you want to preserve git history, you can use git subtree:

```bash
cd /Users/maxjackson/cryptoart/cryptoart-monorepo

# Add the auctionhouse repo as a remote
git remote add auctionhouse-frontend <github-url-or-local-path>

# Fetch its history
git fetch auctionhouse-frontend

# Merge into monorepo (replace 'main' with actual branch name)
git subtree add --prefix=apps/auctionhouse auctionhouse-frontend main

# Remove temporary remote
git remote remove auctionhouse-frontend
```

## Step 4: Update Configuration

After moving, update these files:

### package.json

Ensure the package name matches the monorepo structure:
```json
{
  "name": "auctionhouse",
  "version": "0.1.0"
}
```

### Update Import Paths (if needed)

Check for any absolute imports that reference the old structure:
- Look for imports like `@/` or `~/` that might need adjustment
- Update any relative paths that broke during the move

### Update Workspace References

If the app references other packages in the monorepo:
- Update package names to use workspace protocol (e.g., `@repo/ui`, `@repo/db`)
- Ensure imports match the new monorepo structure

## Step 5: Verify Integration

After moving:

```bash
cd /Users/maxjackson/cryptoart/cryptoart-monorepo

# Install dependencies
pnpm install

# Try building the app
cd apps/auctionhouse
pnpm build

# Test development server
pnpm dev
```

## Step 6: Update Documentation

After successfully moving:

1. Update `README.md` to mention the auctionhouse app
2. Update `llms-full.md` to include auctionhouse documentation
3. Add any app-specific documentation

## Troubleshooting

### Build Errors

- Check that all dependencies are installed: `pnpm install`
- Verify TypeScript config is correct
- Check for missing environment variables

### Import Errors

- Verify all workspace packages are properly referenced
- Check that package names match in `package.json` files
- Ensure Turborepo can see the app (check `turbo.json`)

### Missing Dependencies

- Run `pnpm install` from the monorepo root
- Check if dependencies need to be added to root `package.json`

## Next Steps

Once the auctionhouse frontend is moved:

1. Test that it builds and runs correctly
2. Update any CI/CD configurations
3. Update deployment scripts if needed
4. Commit the changes to git

## Questions to Answer

Before moving, determine:

- [ ] Where is the auctionhouse frontend currently located?
- [ ] Does it have its own git repository?
- [ ] What dependencies does it require?
- [ ] Does it need to reference other packages in the monorepo?
- [ ] Are there any special build/deployment requirements?

## Notes

- The auctionhouse frontend should be a Next.js application compatible with the monorepo structure
- It should follow the same patterns as `apps/cryptoart-studio-app/`
- Consider using shared packages like `@repo/ui` for common components
- Environment variables should be documented in the app's README

