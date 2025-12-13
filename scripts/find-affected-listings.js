// Script to find all listings affected by the startTime=0 endTime bug
// Usage: node scripts/find-affected-listings.js

const https = require('https');
const http = require('http');

// Allow self-signed certificates
const agent = new https.Agent({
  rejectUnauthorized: false
});

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { agent: url.startsWith('https') ? agent : undefined }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function findAffectedListings() {
  try {
    console.log('Fetching all listings...');
    
    // Get active listings
    const activeData = await fetchJSON('https://cryptoart.social/api/auctions/active?first=1000&skip=0');
    const activeListings = activeData.auctions || [];
    console.log(`Found ${activeListings.length} active listings`);
    
    // Get recently concluded listings
    const concludedData = await fetchJSON('https://cryptoart.social/api/listings/recently-concluded?first=1000');
    const concludedListings = concludedData.listings || [];
    console.log(`Found ${concludedListings.length} concluded listings`);
    
    // Combine and dedupe by listingId
    const listingMap = new Map();
    [...activeListings, ...concludedListings].forEach(listing => {
      const id = listing.listingId || listing.id;
      if (id && !listingMap.has(id)) {
        listingMap.set(id, listing);
      }
    });
    
    const listings = Array.from(listingMap.values());
    console.log(`Total unique listings to check: ${listings.length}\n`);

    const affected = []; // Listings where bug has been triggered (startTime > 0, endTime way in future)
    const atRisk = [];   // Listings where bug is present but not triggered (startTime = 0, endTime is absolute timestamp)
    const now = Math.floor(Date.now() / 1000);
    const tenYears = 10 * 365 * 24 * 60 * 60;

    for (const listing of listings) {
      const listingId = listing.listingId || listing.id;
      if (!listingId) continue;

      try {
        console.log(`Checking listing ${listingId}...`);
        const debugData = await fetchJSON(`https://cryptoart.social/api/debug/listing/${listingId}`);
        
        const contract = debugData.contract?.details;
        const subgraph = debugData.subgraph;
        
        if (!contract || !subgraph) continue;

        const contractStart = Number(contract.startTime || 0);
        const contractEnd = Number(contract.endTime || 0);
        const subgraphStart = parseInt(subgraph.startTime || 0);
        const subgraphEnd = parseInt(subgraph.endTime || 0);

        // CASE 1: Bug has been triggered (auction started, endTime is way in future)
        // - Contract endTime is way in future (> 10 years from now)
        // - Subgraph endTime is reasonable (< 10 years from now, and > 0)
        // - Contract startTime > 0 (meaning first bid was placed, triggering the bug)
        const isContractEndFuture = contractEnd > now + tenYears;
        const isSubgraphEndReasonable = subgraphEnd > 0 && subgraphEnd < now + tenYears;
        const hasStarted = contractStart > 0;
        
        if (isContractEndFuture && isSubgraphEndReasonable && hasStarted) {
          // Additional check: if contract endTime - subgraph endTime ≈ contract startTime,
          // that's a strong indicator of the bug (endTime + startTime)
          const expectedBugResult = subgraphEnd + contractStart;
          const diffFromExpected = Math.abs(contractEnd - expectedBugResult);
          const isLikelyBug = diffFromExpected < 1000; // Allow 1000s tolerance
          
          if (isLikelyBug) {
          const diff = contractEnd - subgraphEnd;
          const diffDays = Math.floor(diff / 86400);
          
          const contractEndDate = contractEnd < 4000000000 
            ? new Date(contractEnd * 1000).toISOString()
            : `Year ${new Date(contractEnd * 1000).getFullYear()}`;
          const subgraphEndDate = new Date(subgraphEnd * 1000).toISOString();

          affected.push({
            listingId,
            title: listing.title || debugData.subgraph?.title || 'Unknown',
            seller: listing.seller || debugData.subgraph?.seller || 'Unknown',
            contractStartTime: contractStart,
            contractEndTime: contractEnd,
            contractEndDate,
            subgraphStartTime: subgraphStart,
            subgraphEndTime: subgraphEnd,
            subgraphEndDate,
            differenceSeconds: diff,
            differenceDays: diffDays,
            expectedBugResult,
            isLikelyBug,
            diffFromExpected,
            hasBid: listing.hasBid || debugData.subgraph?.hasBid || false,
            bidCount: listing.bidCount || 0,
            status: listing.status || debugData.subgraph?.status || 'ACTIVE',
          });
          }
        }
        
        // CASE 2: Bug present but not triggered (auction hasn't started, endTime is absolute timestamp)
        // - Contract startTime = 0 (hasn't started yet)
        // - Subgraph startTime = 0 (matches)
        // - Subgraph endTime is an absolute timestamp (reasonable date, not a duration)
        // - When first bid comes in, contract will add block.timestamp to this absolute value, causing bug
        const hasntStarted = contractStart === 0 && subgraphStart === 0;
        const endTimeIsAbsolute = subgraphEnd > 0 && subgraphEnd < now + tenYears && subgraphEnd > 1000000000; // After year 2001, so likely a timestamp
        
        if (hasntStarted && endTimeIsAbsolute) {
          // Calculate what would happen when first bid is placed
          // If first bid came in now, endTime would become: subgraphEnd + now
          // This would be way in the future (year 2045+)
          const wouldBecome = subgraphEnd + now;
          const wouldBecomeYear = new Date(wouldBecome * 1000).getFullYear();
          
          atRisk.push({
            listingId,
            title: listing.title || debugData.subgraph?.title || 'Unknown',
            seller: listing.seller || debugData.subgraph?.seller || 'Unknown',
            subgraphStartTime: subgraphStart,
            subgraphEndTime: subgraphEnd,
            subgraphEndDate: new Date(subgraphEnd * 1000).toISOString(),
            wouldBecome,
            wouldBecomeYear,
            daysUntilEnd: Math.floor((subgraphEnd - now) / 86400),
            hasBid: listing.hasBid || debugData.subgraph?.hasBid || false,
            bidCount: listing.bidCount || 0,
            status: listing.status || debugData.subgraph?.status || 'ACTIVE',
          });
        }
      } catch (error) {
        console.error(`  Error checking listing ${listingId}: ${error.message}`);
      }
    }

    console.log(`\n=== AFFECTED LISTINGS (${affected.length}) - Bug Already Triggered ===\n`);
    
    if (affected.length === 0 && atRisk.length === 0) {
      console.log('No affected or at-risk listings found!');
      return;
    }

    // Sort by listing ID
    affected.sort((a, b) => parseInt(a.listingId) - parseInt(b.listingId));

    for (const item of affected) {
      console.log(`Listing ID: ${item.listingId}`);
      console.log(`  Title: ${item.title}`);
      console.log(`  Seller: ${item.seller}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  Has Bid: ${item.hasBid} (${item.bidCount} bids)`);
      console.log(`  Contract startTime: ${item.contractStartTime} (${new Date(item.contractStartTime * 1000).toISOString()})`);
      console.log(`  Contract endTime: ${item.contractEndTime} (${item.contractEndDate})`);
      console.log(`  Subgraph endTime: ${item.subgraphEndTime} (${item.subgraphEndDate})`);
      console.log(`  Difference: ${item.differenceDays} days (${Math.floor(item.differenceSeconds / 3600)} hours)`);
      console.log(`  URL: https://cryptoart.social/listing/${item.listingId}`);
      console.log();
    }

    console.log(`\n=== AT-RISK LISTINGS (${atRisk.length}) - Bug Present But Not Triggered ===\n`);
    
    if (atRisk.length > 0) {
      atRisk.sort((a, b) => parseInt(a.listingId) - parseInt(b.listingId));
      
      for (const item of atRisk) {
        console.log(`Listing ID: ${item.listingId}`);
        console.log(`  Title: ${item.title}`);
        console.log(`  Seller: ${item.seller}`);
        console.log(`  Status: ${item.status}`);
        console.log(`  Has Bid: ${item.hasBid} (${item.bidCount} bids)`);
        console.log(`  Subgraph startTime: ${item.subgraphStartTime} (not started)`);
        console.log(`  Subgraph endTime: ${item.subgraphEndTime} (${item.subgraphEndDate})`);
        console.log(`  Days until subgraph endTime: ${item.daysUntilEnd}`);
        console.log(`  ⚠️  If first bid placed now, contract endTime would become: ${item.wouldBecomeYear} (${new Date(item.wouldBecome * 1000).toISOString()})`);
        console.log(`  URL: https://cryptoart.social/listing/${item.listingId}`);
        console.log();
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total affected listings (bug triggered): ${affected.length}`);
    console.log(`Total at-risk listings (bug present): ${atRisk.length}`);
    console.log(`Affected Listing IDs: ${affected.length > 0 ? affected.map(a => a.listingId).join(', ') : 'None'}`);
    console.log(`At-Risk Listing IDs: ${atRisk.length > 0 ? atRisk.map(a => a.listingId).join(', ') : 'None'}`);

    // Create a markdown report
    const markdown = `# Affected Listings Report

**Generated:** ${new Date().toISOString()}
**Total Affected (Bug Triggered):** ${affected.length}
**Total At-Risk (Bug Present):** ${atRisk.length}

## Affected Listings (Bug Already Triggered)

These listings have received bids, causing the bug to trigger. The contract endTime is now way in the future, preventing finalization.

${affected.map(item => `### Listing ${item.listingId}: ${item.title}

- **Seller:** ${item.seller}
- **Status:** ${item.status}
- **Has Bid:** ${item.hasBid} (${item.bidCount} bids)
- **Contract endTime:** ${item.contractEndTime} (${item.contractEndDate})
- **Subgraph endTime:** ${item.subgraphEndTime} (${item.subgraphEndDate})
- **Difference:** ${item.differenceDays} days
- **URL:** https://cryptoart.social/listing/${item.listingId}

**Issue:** Contract endTime is set way in the future (${item.contractEndDate}) due to the startTime=0 bug. The contract treated an absolute timestamp as a duration and added block.timestamp to it, preventing finalization.

`).join('\n')}

${atRisk.length > 0 ? `## At-Risk Listings (Bug Present But Not Triggered)

These listings haven't received bids yet, but they have the bug present. Once the first bid is placed, the contract will incorrectly add block.timestamp to the already-absolute endTime value.

${atRisk.map(item => `### Listing ${item.listingId}: ${item.title}

- **Seller:** ${item.seller}
- **Status:** ${item.status}
- **Has Bid:** ${item.hasBid} (${item.bidCount} bids)
- **Subgraph endTime:** ${item.subgraphEndTime} (${item.subgraphEndDate})
- **Days until subgraph endTime:** ${item.daysUntilEnd} days
- **⚠️ If first bid placed now, contract endTime would become:** ${item.wouldBecomeYear} (${new Date(item.wouldBecome * 1000).toISOString()})
- **URL:** https://cryptoart.social/listing/${item.listingId}

**Issue:** Listing has startTime=0 with an absolute endTime timestamp. When the first bid is placed, the contract will add block.timestamp to this value, creating an invalid endTime way in the future.

`).join('\n')}` : ''}

## Root Cause

Listings created with startTime=0 (starts on first bid) that had an endTime sent as an absolute timestamp instead of a duration. When the first bid was placed, the contract added block.timestamp to the already-absolute endTime value, creating an invalid endTime far in the future.

## Impact

These listings cannot be finalized through the normal finalize() function because the contract's endTime check fails (endTime < block.timestamp is false).

## Resolution

1. Fix has been applied to prevent new listings from having this issue
2. Affected listings require manual intervention (contract upgrade or admin function) to fix
`;

    const fs = require('fs');
    fs.writeFileSync('AFFECTED_LISTINGS_REPORT.md', markdown);
    console.log('\nReport saved to AFFECTED_LISTINGS_REPORT.md');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findAffectedListings();

