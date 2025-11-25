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
  
  try {
    // Clone the repo
    if (fs.existsSync(clonePath)) {
      console.log(`  Repository already cloned, pulling latest...`);
      execSync(`git pull origin ${branch}`, { cwd: clonePath, stdio: 'pipe' });
    } else {
      console.log(`  Cloning ${urlPart} (branch: ${branch})...`);
      execSync(`git clone -b ${branch} ${urlPart} ${clonePath}`, {
        stdio: 'pipe'
      });
    }
    
    // Find and convert workspace:* deps in the cloned repo
    console.log(`  Converting workspace:* deps in cloned repo...`);
    function convertWorkspaceDeps(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !['node_modules', '.git'].includes(file)) {
          convertWorkspaceDeps(filePath);
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
      }
    }
    
    convertWorkspaceDeps(clonePath);
    
    // Install the git dependency from local path
    console.log(`  Installing ${dep.name} from local clone...`);
    packageJson[dep.type][dep.name] = `file:${path.relative(repoRoot, clonePath)}`;
    
  } catch (error) {
    console.error(`  Failed to handle ${dep.name}:`, error.message);
    // Restore original
    packageJson[dep.type][dep.name] = dep.version;
  }
}

// Update package.json with local paths
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('\nUpdated package.json with local git dependency paths');

// Install git dependencies from local paths
console.log('\nInstalling git dependencies from local paths...');
try {
  execSync('npm install --legacy-peer-deps', {
    cwd: repoRoot,
    stdio: 'inherit'
  });
  console.log('✓ Git dependencies installed');
} catch (error) {
  console.error('Failed to install git dependencies');
  // Restore package.json
  fs.copyFileSync(packageJsonBackup, packageJsonPath);
  fs.unlinkSync(packageJsonBackup);
  process.exit(1);
}

// Restore original package.json (but keep the changes for reference)
// Actually, let's keep the local paths since they work
console.log('\n✓ All dependencies installed successfully');
console.log('Note: Git dependencies are now using local file paths');

// Clean up backup
if (fs.existsSync(packageJsonBackup)) {
  fs.unlinkSync(packageJsonBackup);
}

