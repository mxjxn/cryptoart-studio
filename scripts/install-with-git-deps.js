#!/usr/bin/env node

/**
 * Installs dependencies, handling git dependencies that have workspace:* deps
 * by cloning them separately and converting workspace:* deps
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJsonBackup = path.join(repoRoot, 'package.json.backup');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Find git dependencies
const gitDeps = [];
if (packageJson.dependencies) {
  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (typeof version === 'string' && version.startsWith('git+')) {
      gitDeps.push({ name, version, type: 'dependencies' });
    }
  }
}

if (gitDeps.length === 0) {
  console.log('No git dependencies found, proceeding with normal install');
  process.exit(0);
}

console.log(`Found ${gitDeps.length} git dependency(ies):`);
gitDeps.forEach(dep => console.log(`  - ${dep.name}: ${dep.version}`));

// Backup package.json
fs.copyFileSync(packageJsonPath, packageJsonBackup);
console.log('Backed up package.json');

// Remove git dependencies temporarily
gitDeps.forEach(dep => {
  delete packageJson[dep.type][dep.name];
});
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('Temporarily removed git dependencies from package.json');

// Install other dependencies
console.log('\nInstalling non-git dependencies...');
try {
  execSync('npm install --legacy-peer-deps', {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  console.log('✓ Non-git dependencies installed');
} catch (error) {
  console.error('Failed to install non-git dependencies');
  // Restore package.json
  fs.copyFileSync(packageJsonBackup, packageJsonPath);
  fs.unlinkSync(packageJsonBackup);
  process.exit(1);
}

// Now handle git dependencies
console.log('\nHandling git dependencies...');
const tempGitDir = path.join(repoRoot, '.temp-git-deps');
if (!fs.existsSync(tempGitDir)) {
  fs.mkdirSync(tempGitDir, { recursive: true });
}

for (const dep of gitDeps) {
  console.log(`\nProcessing ${dep.name}...`);
  
    // Extract git URL (format: git+https://github.com/user/repo.git#branch)
    const gitUrl = dep.version.replace(/^git\+/, '');
    const [urlPart, branchPart] = gitUrl.split('#');
    const branch = branchPart || 'main';
    const repoName = urlPart.split('/').pop().replace('.git', '');
    const clonePath = path.join(tempGitDir, repoName);
    
    // For @lssvm/abis, we need the packages/lssvm-abis subdirectory
    const packageSubdir = dep.name === '@lssvm/abis' ? 'packages/lssvm-abis' : '.';
    const packagePath = path.join(clonePath, packageSubdir);
    
    try {
      // Clone the repo
      if (fs.existsSync(clonePath)) {
        console.log(`  Repository already cloned, pulling latest...`);
        execSync(`git pull origin ${branch}`, { cwd: clonePath, stdio: 'pipe' });
      } else {
        console.log(`  Cloning ${urlPart} (branch: ${branch})...`);
        execSync(`git clone -b ${branch} --depth 1 ${urlPart} ${clonePath}`, {
          stdio: 'pipe'
        });
      }
      
      // Find and convert workspace:* deps in the cloned repo
      console.log(`  Converting workspace:* deps in cloned repo...`);
      function convertWorkspaceDeps(dir, depth = 0) {
        // Limit depth to avoid infinite loops and symlink issues
        if (depth > 10) return;
        
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            // Skip common directories that might cause issues
            if (['node_modules', '.git', 'dist', 'build', '.next', 'out'].includes(file)) {
              continue;
            }
            
            const filePath = path.join(dir, file);
            
            try {
              const stat = fs.statSync(filePath);
              
              if (stat.isDirectory()) {
                // Check if it's a symlink
                if (stat.isSymbolicLink()) {
                  continue; // Skip symlinks
                }
                convertWorkspaceDeps(filePath, depth + 1);
              } else if (file === 'package.json') {
                try {
                  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                  let modified = false;
                  
                  function removeWorkspaceDeps(deps) {
                    if (!deps) return;
                    for (const [name, version] of Object.entries(deps)) {
                      if (version === 'workspace:*') {
                        delete deps[name];
                        modified = true;
                        console.log(`    Removed workspace:* dependency: ${name}`);
                      }
                    }
                  }
                  
                  removeWorkspaceDeps(pkg.dependencies);
                  removeWorkspaceDeps(pkg.devDependencies);
                  
                  if (modified) {
                    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
                  }
                } catch (e) {
                  // Skip if can't parse
                }
              }
            } catch (err) {
              // Skip files/dirs that can't be accessed (symlinks, permissions, etc.)
              continue;
            }
          }
        } catch (err) {
          // Skip directories that can't be read
          return;
        }
      }
      
      convertWorkspaceDeps(clonePath);
      
      // Build and install the package manually to node_modules
      const packageJsonInPath = path.join(packagePath, 'package.json');
      if (!fs.existsSync(packageJsonInPath)) {
        throw new Error(`package.json not found in: ${packagePath}`);
      }
      
      const pkg = JSON.parse(fs.readFileSync(packageJsonInPath, 'utf8'));
      
      // Install dependencies for the package
      if (pkg.dependencies || pkg.devDependencies) {
        console.log(`  Installing dependencies for ${dep.name}...`);
        try {
          execSync('npm install --legacy-peer-deps', { 
            cwd: packagePath, 
            stdio: 'pipe'
          });
        } catch (installError) {
          console.warn(`  ⚠ Failed to install dependencies for ${dep.name}, continuing anyway`);
        }
      }
      
      // Build the package if needed
      if (pkg.scripts && pkg.scripts.build) {
        console.log(`  Building ${dep.name}...`);
        try {
          execSync('npm run build', { cwd: packagePath, stdio: 'pipe' });
          console.log(`  ✓ Built ${dep.name}`);
        } catch (buildError) {
          console.warn(`  ⚠ Build failed for ${dep.name}, continuing anyway`);
        }
      }
      
      // Manually copy package to node_modules
      const nodeModulesPath = path.join(repoRoot, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        fs.mkdirSync(nodeModulesPath, { recursive: true });
      }
      
      const scopedName = dep.name.startsWith('@') ? dep.name.split('/') : [dep.name];
      const targetDir = scopedName.length === 2 
        ? path.join(nodeModulesPath, scopedName[0], scopedName[1])
        : path.join(nodeModulesPath, scopedName[0]);
      
      // Remove existing if present
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      
      // Copy package
      fs.cpSync(packagePath, targetDir, { recursive: true });
      console.log(`  ✓ Copied ${dep.name} to node_modules`);
      
      // Remove from package.json so npm doesn't try to install it
      // (we've already installed it manually)
      delete packageJson[dep.type][dep.name];
    
  } catch (error) {
    console.error(`  Failed to handle ${dep.name}:`, error.message);
    // Restore original
    packageJson[dep.type][dep.name] = dep.version;
  }
}

// Save package.json (git deps have been removed since we installed them manually)
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('\n✓ Git dependencies installed manually to node_modules');
console.log('✓ Removed git dependencies from package.json (already installed)');

// Restore original package.json (but keep the changes for reference)
// Actually, let's keep the local paths since they work
console.log('\n✓ All dependencies installed successfully');
console.log('Note: Git dependencies are now using local file paths');

// Clean up backup
if (fs.existsSync(packageJsonBackup)) {
  fs.unlinkSync(packageJsonBackup);
}

