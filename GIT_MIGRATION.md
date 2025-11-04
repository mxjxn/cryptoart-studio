# Git History Migration Guide

Since your projects are already moved into the monorepo with their git histories intact, here are your options:

## Option 1: Keep Nested Git Repos (Simplest for Now)

You can leave the nested `.git` folders as-is and initialize git at the root:

```bash
cd /Users/maxjackson/cryptoart/cryptoart-monorepo
git init
git add package.json turbo.json README.md llms-full.md .gitignore
git commit -m "feat: initialize monorepo structure"

# The nested .git folders remain, and you can merge histories later
```

**Pros:** Quick, preserves all history, can merge later  
**Cons:** Nested repos can be confusing

## Option 2: Merge Histories Using Git Subtree (Recommended)

Merge each project's history into the monorepo root:

```bash
cd /Users/maxjackson/cryptoart/cryptoart-monorepo

# Initialize root
git init
git add package.json turbo.json README.md llms-full.md .gitignore
git commit -m "feat: initialize monorepo structure"

# For each project, get its GitHub URL and merge:
cd apps/auctionhouse
AUCTIONHOUSE_URL=$(git remote get-url origin)
BRANCH=$(git branch --show-current)
cd ../..

git remote add auctionhouse-temp "$AUCTIONHOUSE_URL"
git fetch auctionhouse-temp
git subtree add --prefix=apps/auctionhouse auctionhouse-temp "$BRANCH"
git remote remove auctionhouse-temp

# Repeat for:
# - apps/backend
# - packages/creator-core  
# - packages/auctionhouse-contracts

# Clean up nested .git folders
rm -rf apps/*/.git packages/*/.git
git add .
git commit -m "chore: remove nested git repositories"
```

## Option 3: Convert to Git Submodules

Keep projects as separate repos but reference them:

```bash
# First, ensure each project is pushed to GitHub
cd apps/auctionhouse && git push origin main && cd ../..

# Remove directories (they're safe on GitHub)
cd /Users/maxjackson/cryptoart/cryptoart-monorepo
rm -rf apps/auctionhouse apps/backend packages/creator-core packages/auctionhouse-contracts

# Initialize monorepo
git init
git add package.json turbo.json README.md llms-full.md .gitignore
git commit -m "feat: initialize monorepo structure"

# Add as submodules
git submodule add <github-url-auctionhouse> apps/auctionhouse
git submodule add <github-url-backend> apps/backend
git submodule add <github-url-creator-core> packages/creator-core
git submodule add <github-url-auctionhouse-contracts> packages/auctionhouse-contracts

git commit -m "feat: add projects as git submodules"
```

## Recommendation

**Start with Option 1** (keep nested repos) to get started quickly, then migrate to **Option 2** (merge histories) when you're ready. This preserves all history while letting you work immediately.

## Next Steps

1. Check what remotes each project has:
   ```bash
   cd apps/auctionhouse && git remote -v && cd ../..
   ```

2. Decide which approach you prefer

3. If you want help with the merge, provide the GitHub URLs for each project and I can help set it up!
