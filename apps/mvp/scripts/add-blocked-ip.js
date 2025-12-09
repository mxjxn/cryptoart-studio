#!/usr/bin/env node

/**
 * Quick script to add a blocked IP to middleware.ts
 * Usage: node scripts/add-blocked-ip.js <IP_ADDRESS>
 */

const fs = require('fs');
const path = require('path');

const IP_ADDRESS = process.argv[2];

if (!IP_ADDRESS) {
  console.error('Usage: node scripts/add-blocked-ip.js <IP_ADDRESS>');
  console.error('Example: node scripts/add-blocked-ip.js 1.2.3.4');
  process.exit(1);
}

// Validate IP format
const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
if (!ipRegex.test(IP_ADDRESS)) {
  console.error(`Error: Invalid IP address format: ${IP_ADDRESS}`);
  process.exit(1);
}

const middlewarePath = path.join(__dirname, '../src/middleware.ts');

try {
  let content = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check if IP is already blocked
  if (content.includes(`'${IP_ADDRESS}'`) || content.includes(`"${IP_ADDRESS}"`)) {
    console.log(`IP ${IP_ADDRESS} is already blocked`);
    process.exit(0);
  }
  
  // Find the BLOCKED_IPS Set and add the IP
  const blockedIPsRegex = /const BLOCKED_IPS = new Set<string>\(\[([\s\S]*?)\]\);/;
  const match = content.match(blockedIPsRegex);
  
  if (!match) {
    console.error('Error: Could not find BLOCKED_IPS in middleware.ts');
    process.exit(1);
  }
  
  // Get existing IPs
  const existingIPs = match[1]
    .split(',')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.replace(/['"]/g, ''));
  
  // Add new IP
  existingIPs.push(IP_ADDRESS);
  
  // Rebuild the Set with all IPs
  const ipList = existingIPs
    .map(ip => `    '${ip}',`)
    .join('\n');
  
  const newBlockedIPs = `const BLOCKED_IPS = new Set<string>([\n${ipList}\n  ]);`;
  
  // Replace in content
  content = content.replace(blockedIPsRegex, newBlockedIPs);
  
  // Write back
  fs.writeFileSync(middlewarePath, content, 'utf8');
  
  console.log(`✅ Successfully added IP ${IP_ADDRESS} to blocked list`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the changes: git diff src/middleware.ts`);
  console.log(`2. Commit and deploy:`);
  console.log(`   git add src/middleware.ts`);
  console.log(`   git commit -m "Block attacking IP ${IP_ADDRESS}"`);
  console.log(`   git push`);
  
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}





