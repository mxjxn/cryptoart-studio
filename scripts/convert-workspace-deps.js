#!/usr/bin/env node

/**
 * Converts pnpm workspace:* dependencies to npm-compatible file: paths
 * This allows npm to install dependencies in a pnpm monorepo
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findPackageJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other build directories
      if (!['node_modules', '.next', 'dist', 'build', '.turbo'].includes(file)) {
        findPackageJsonFiles(filePath, fileList);
      }
    } else if (file === 'package.json') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function findWorkspacePackage(repoRoot, packageName) {
  // Remove scope if present (e.g., @cryptoart/db -> db)
  const simpleName = packageName.replace(/^@[^/]+\//, '');
  
  // Try packages directory first
  const packagesPath = path.join(repoRoot, 'packages', simpleName, 'package.json');
  if (fs.existsSync(packagesPath)) {
    return path.join(repoRoot, 'packages', simpleName);
  }
  
  // Try apps directory
  const appsPath = path.join(repoRoot, 'apps', simpleName, 'package.json');
  if (fs.existsSync(appsPath)) {
    return path.join(repoRoot, 'apps', simpleName);
  }
  
  return null;
}

function convertWorkspaceDeps(packageJsonPath) {
  const content = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(content);
  let modified = false;
  
  const pkgDir = path.dirname(packageJsonPath);
  const repoRoot = path.resolve(__dirname, '..');
  
  function convertDeps(deps) {
    if (!deps) return;
    
    for (const [depName, depVersion] of Object.entries(deps)) {
      if (depVersion === 'workspace:*') {
        const workspacePkgPath = findWorkspacePackage(repoRoot, depName);
        
        if (workspacePkgPath) {
          const relativePath = path.relative(pkgDir, workspacePkgPath);
          deps[depName] = `file:${relativePath}`;
          modified = true;
          console.log(`  ${depName}: workspace:* -> file:${relativePath}`);
        } else {
          console.warn(`  Warning: Could not find workspace package for ${depName}`);
        }
      }
    }
  }
  
  convertDeps(pkg.dependencies);
  convertDeps(pkg.devDependencies);
  
  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ Converted workspace:* deps in ${path.relative(repoRoot, packageJsonPath)}`);
  }
}

// Find all package.json files
const repoRoot = path.resolve(__dirname, '..');
const packageJsonFiles = findPackageJsonFiles(repoRoot);

console.log(`Found ${packageJsonFiles.length} package.json files`);

// Convert workspace:* dependencies in local files
packageJsonFiles.forEach(convertWorkspaceDeps);

// Handle git dependencies that might have workspace:* deps
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const gitDeps = [];

function findGitDeps(deps) {
  if (!deps) return;
  for (const [depName, depVersion] of Object.entries(deps)) {
    if (typeof depVersion === 'string' && depVersion.startsWith('git+')) {
      gitDeps.push({ name: depName, url: depVersion });
    }
  }
}

findGitDeps(rootPackageJson.dependencies);
findGitDeps(rootPackageJson.devDependencies);

// Also check all package.json files for git deps
packageJsonFiles.forEach(pkgPath => {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    findGitDeps(pkg.dependencies);
    findGitDeps(pkg.devDependencies);
  } catch (e) {
    // Skip if can't parse
  }
});

if (gitDeps.length > 0) {
  console.log(`\nFound ${gitDeps.length} git dependency(ies). Note: Git dependencies with workspace:* deps may need manual handling.`);
  gitDeps.forEach(dep => {
    console.log(`  - ${dep.name}: ${dep.url}`);
  });
  console.log('\nNote: If git dependencies have workspace:* deps, npm may fail. Consider using a published package or local file path instead.');
}

console.log('\nWorkspace dependency conversion complete');

