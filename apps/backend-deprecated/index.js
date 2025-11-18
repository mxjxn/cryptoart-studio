require('dotenv').config();
const { ethers } = require('ethers');
const config = require('./config');

// Event signatures for library events (not in main contract ABI)
const libraryEventSignatures = {
  // Admin configuration events
  '0x399d744aed2a748ad035a6b7e41fec32306c4226e1376bd0017a60b9154d9d5c': 'SetFees',
  '0x5bade386a6c8f7462e49fcd944dce32208fd2bb5d19e8a1b610a0ea61b8e37ed': 'SetRoyaltyEnforcement',
  '0x7b71aacd23ea781673f15e1659e8601ac18ec094ab50ed668f9c43175c4bad81': 'SetSellerRegistration',

  // Marketplace library events
  '0xa677084ea9aea69b2640d875bae622e3cf9d7c163f52d2f9d81daa1ed072c985': 'CreateListing',
  '0xc43fa59bf811b406292f853c5888b214b0e868c12884ca93b4956648caa6938a': 'CreateListingTokenDetails',
  '0xa1d8cbc344f33f79082234478778f9af7652b2562b79a8c118d31ee97017930f': 'CreateListingFees',
  '0x0e0d473f43a9d8727e62653cce4cd80d0c870ffb83dc4c93c9db4cb8ffe7053e': 'PurchaseEvent',
  '0xd12be072db02c5c389af56d30a7ef86f64b7b60048f3875c6d00fc240d2d92b6': 'BidEvent',
  '0x73535bde202cd31a2fe12c1b9e7903a1b273e46e0dbc7d55dc586af898543701': 'OfferEvent',
  '0x3d13f7b5271fd88ba34bfa097c4b522a61f0cfeb1621d43bfae01034fa421e4f': 'RescindOfferEvent',
  '0xd6df7c9a0f20ac7b678de872504d1dc938cd654638a43d5312d295e51c23e470': 'AcceptOfferEvent',
  '0xde38900f75163598713718d539a09596c3c1b9bacd1432ea1be04fa658d0cada': 'ModifyListing',
  '0x19ef8c897f0ad4be12bac96be8f4a3984059ae9566f02163b0e48cf00f9aa338': 'CancelListing',
  '0x7a64269d6d03ead41925c75675255493546f656ebb9cae4158fea2633d86c541': 'FinalizeListing'
};

// Connect to Alchemy RPC
async function connectToAlchemy() {
  const apiKey = config.alchemyApiKey || process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('Alchemy API key not found');
  }

  const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
  console.log(`Using RPC: https://base-mainnet.g.alchemy.com/v2/${apiKey.substring(0, 8)}...`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();

  console.log(`✅ Connected to Base`);
  console.log(`   Current block: ${blockNumber}\n`);

  return provider;
}

// Process library events by signature
function processLibraryEvent(log, eventName) {
  console.log('\n' + '='.repeat(80));
  console.log(`📢 Event: ${eventName}`);
  console.log('='.repeat(80));

  try {
    if (eventName === 'SetFees') {
      const addr = ethers.getAddress('0x' + log.data.slice(26, 66));
      const num1 = parseInt(log.data.slice(66, 130), 16);
      const num2 = parseInt(log.data.slice(130, 194), 16);
      console.log(`   Sender: ${addr}`);
      console.log(`   Marketplace BPS: ${num1}`);
      console.log(`   Referrer BPS: ${num2}`);
    } else if (eventName === 'SetRoyaltyEnforcement') {
      const addr = ethers.getAddress('0x' + log.data.slice(26, 66));
      console.log(`   Enforcement Contract: ${addr}`);
    } else if (eventName === 'SetSellerRegistration') {
      const addr1 = ethers.getAddress('0x' + log.data.slice(26, 66));
      const addr2 = ethers.getAddress('0x' + log.data.slice(66, 106));
      console.log(`   Sender: ${addr1}`);
      console.log(`   Registry Contract: ${addr2}`);
    } else if (log.topics.length > 1) {
      // Events with indexed parameters (listingId in topic 1)
      const listingId = BigInt(log.topics[1]);
      console.log(`   Listing ID: ${listingId}`);

      if (eventName === 'CreateListing' || eventName === 'ModifyListing' || eventName === 'CancelListing' || eventName === 'FinalizeListing') {
        console.log(`   Full data: ${log.data}`);
      }
    } else {
      console.log(`   Raw data: ${log.data}`);
    }
  } catch (e) {
    console.log(`   (Could not fully decode)`);
  }

  console.log('='.repeat(80));
}

async function scanBlockRange(provider, startBlock, endBlock) {
  console.log(`🔍 Scanning blocks ${startBlock} to ${endBlock}`);
  console.log('='.repeat(80));

  let eventsFound = 0;
  let currentBlock = startBlock;

  while (currentBlock <= endBlock) {
    try {
      const block = await provider.getBlock(currentBlock, true);
      if (!block || !block.transactions) {
        currentBlock++;
        continue;
      }

      for (const txHash of block.transactions) {
        try {
          const receipt = await provider.getTransactionReceipt(txHash);

          if (!receipt || !receipt.logs) continue;

          for (const log of receipt.logs) {
            // Only process logs from our marketplace contract
            if (log.address.toLowerCase() === config.marketplaceAddress.toLowerCase()) {
              const eventSig = log.topics[0];
              const eventName = libraryEventSignatures[eventSig];

            if (eventName) {
              eventsFound++;
              console.log(`\n📌 Block ${currentBlock}: ${eventName}`);
              console.log(`📦 TX Hash: ${txHash}`);
              console.log(`📦 Block: https://basescan.org/block/${currentBlock}`);
              processLibraryEvent(log, eventName);
            }
            }
          }
        } catch (txError) {
          // Skip individual transaction errors
        }
      }

      currentBlock++;

      // Progress indicator every 100 blocks
      if ((currentBlock - startBlock) % 100 === 0) {
        console.log(`... scanned ${currentBlock - startBlock} blocks, found ${eventsFound} events so far...`);
      }

    } catch (error) {
      console.error(`Error scanning block ${currentBlock}:`, error.message);
      currentBlock++;
    }
  }

  console.log(`\n✅ Scan complete! Found ${eventsFound} library events in ${endBlock - startBlock} blocks\n`);
  return eventsFound;
}

async function main() {
  try {
    console.log('🚀 Starting Marketplace Indexer...');
    console.log('='.repeat(80));

    const provider = await connectToAlchemy();
    const currentBlock = await provider.getBlockNumber();

    // For now, just verify the 3 original transactions work
    const startBlock = 30437036;

    console.log(`📍 Verifying the 3 original transactions in block ${startBlock}\n`);

    await scanBlockRange(provider, startBlock, startBlock);

    console.log('='.repeat(80));
    console.log('✅ Historical scan complete!');
    console.log('='.repeat(80));
    console.log('\n💡 Next: Update to add real-time monitoring\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  process.exit(0);
});

main().catch(console.error);
