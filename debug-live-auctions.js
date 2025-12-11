// Debug script to check why listing #6 isn't showing in live auctions
const fetch = require('node-fetch');

async function debugLiveAuctions() {
  console.log('=== Debugging Live Auctions Section ===\n');
  
  // 1. Check listing #6 directly
  console.log('1. Checking listing #6 directly:');
  const listing6 = await fetch('https://cryptoart.social/api/auctions/6').then(r => r.json());
  console.log('   Listing #6:', {
    listingId: listing6.auction?.listingId,
    status: listing6.auction?.status,
    finalized: listing6.auction?.finalized,
    startTime: listing6.auction?.startTime,
    endTime: listing6.auction?.endTime,
    bidCount: listing6.auction?.bidCount,
    hasBid: listing6.auction?.hasBid,
    highestBid: listing6.auction?.highestBid ? 'exists' : 'none',
    totalAvailable: listing6.auction?.totalAvailable,
    totalSold: listing6.auction?.totalSold,
    seller: listing6.auction?.seller,
  });
  
  // 2. Check active auctions API
  console.log('\n2. Checking active auctions API:');
  const active = await fetch('https://cryptoart.social/api/auctions/active?first=100&skip=0').then(r => r.json());
  const listing6InActive = active.auctions?.find(a => a.listingId === '6');
  console.log('   Listing #6 in active auctions:', listing6InActive ? 'YES' : 'NO');
  if (listing6InActive) {
    console.log('   Details:', {
      listingId: listing6InActive.listingId,
      status: listing6InActive.status,
      finalized: listing6InActive.finalized,
      bidCount: listing6InActive.bidCount,
      highestBid: listing6InActive.highestBid ? 'exists' : 'none',
    });
  }
  
  // 3. Check which listings have bids
  console.log('\n3. Listings with bids in active auctions:');
  const withBids = active.auctions?.filter(a => (a.bidCount || 0) > 0 || a.highestBid) || [];
  console.log(`   Found ${withBids.length} listings with bids`);
  withBids.forEach(a => {
    console.log(`   - Listing #${a.listingId}: ${a.bidCount || 0} bids, highestBid: ${a.highestBid ? 'yes' : 'no'}`);
  });
  
  // 4. Check homepage layout API
  console.log('\n4. Checking homepage layout API:');
  const layout = await fetch('https://cryptoart.social/api/homepage-layout').then(r => r.json());
  const liveBidsSection = layout.sections?.find(s => s.sectionType === 'live_bids');
  console.log('   Live bids section:', {
    id: liveBidsSection?.id,
    sectionType: liveBidsSection?.sectionType,
    title: liveBidsSection?.title,
    listingsCount: liveBidsSection?.listings?.length || 0,
  });
  
  if (liveBidsSection?.listings?.length > 0) {
    console.log('   Listings in section:');
    liveBidsSection.listings.forEach(l => {
      console.log(`   - Listing #${l.listingId}: ${l.bidCount || 0} bids`);
    });
  } else {
    console.log('   No listings in section!');
  }
  
  // 5. Check if listing #6 should pass the filter
  console.log('\n5. Checking if listing #6 should pass getLiveBids filter:');
  if (listing6InActive) {
    const bidCount = listing6InActive.bidCount || 0;
    const hasHighestBid = !!listing6InActive.highestBid;
    const shouldPass = bidCount > 0 || hasHighestBid;
    console.log(`   bidCount: ${bidCount}`);
    console.log(`   hasHighestBid: ${hasHighestBid}`);
    console.log(`   Should pass filter: ${shouldPass ? 'YES' : 'NO'}`);
  }
  
  // 6. Check time-based filtering
  console.log('\n6. Checking time-based filtering:');
  const now = Math.floor(Date.now() / 1000);
  const start = parseInt(listing6.auction?.startTime || '0');
  const end = parseInt(listing6.auction?.endTime || '0');
  console.log(`   Current time: ${now}`);
  console.log(`   Start time: ${start}`);
  console.log(`   End time: ${end}`);
  console.log(`   Is live (end > now): ${end > now}`);
  console.log(`   Time until end (days): ${((end - now) / 86400).toFixed(2)}`);
}

debugLiveAuctions().catch(console.error);
