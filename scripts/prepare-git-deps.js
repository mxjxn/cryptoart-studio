#!/usr/bin/env node

/**
 * Prepares git dependencies by cloning them and converting workspace:* deps
 * This allows npm to install git dependencies that use pnpm workspace syntax
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempDir = path.join(repoRoot, '.npm-git-deps');

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

function findGitDeps(pkg, deps = []) {
  if (!pkg) return deps;
  
  function checkDeps(depObj) {
    if (!depObj) return;
    for (const [name, version] of Object.entries(depObj)) {
      if (typeof version === 'string' && version.startsWith('git+')) {
        deps.push({ name, url: version });
      }
    }
  }
  
  checkDeps(pkg.dependencies);
  checkDeps(pkg.devDependencies);
  return deps;
}

function convertWorkspaceDepsInDir(dir) {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return false;
  
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(content);
  let modified = false;
  
  function convertDeps(deps) {
    if (!deps) return;
    for (const [depName, depVersion] of Object.entries(deps)) {
      if (depVersion === 'workspace:*') {
        // For git dependencies, we'll just remove workspace:* deps or convert to *
        // Since we can't resolve workspace packages from external repos
        delete deps[depName];
        modified = true;
        console.log(`  Removed workspace:* dependency ${depName} from git dependency`);
      }
    }
  }
  
  convertDeps(pkg.dependencies);
  convertDeps(pkg.devDependencies);
  
  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  }
  
  return modified;
}

// Read root package.json
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const gitDeps = findGitDeps(rootPackageJson);

if (gitDeps.length === 0) {
  console.log('No git dependencies found');
  process.exit(0);
}

console.log(`Found ${gitDeps.length} git dependency(ies):`);
gitDeps.forEach(dep => console.log(`  - ${dep.name}: ${dep.url}`));

// For now, we'll let npm handle git deps but warn about workspace:* issues
// The real fix is to ensure the git repo doesn't have workspace:* deps, or
// we need to handle them differently

console.log('\nNote: If git dependencies have workspace:* deps, they may cause npm install to fail.');
console.log('Consider publishing the package to npm or using a different approach.\n');

process.exit(0);

