/**
 * Script to inspect listing 53 metadata structure
 * Run with: npx tsx scripts/inspect-listing-53.ts
 */

import { fetchNFTMetadata } from '../src/lib/nft-metadata';
import { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from '../src/lib/contracts/marketplace';

const ERC721_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const ERC1155_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'uri',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || 
    process.env.RPC_URL || 
    process.env.NEXT_PUBLIC_BASE_RPC_URL || 
    'https://mainnet.base.org'
  ),
});

async function inspectListing53() {
  console.log('🔍 Inspecting Listing 53 metadata...\n');
  
  // Fetch listing data directly from contract
  let contractData: any = null;
  try {
    contractData = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: 'getListing',
      args: [53],
    });
  } catch (error: any) {
    console.error('Error reading contract:', error);
    return;
  }
  
  if (!contractData || !contractData.token) {
    console.error('❌ Listing 53 not found or invalid');
    return;
  }
  
  const tokenAddress = contractData.token.address_ as Address;
  const tokenId = contractData.token.id.toString();
  const tokenSpec = contractData.token.spec;
  
  console.log('📋 Listing Basic Info:');
  console.log(JSON.stringify({
    listingId: 53,
    tokenAddress,
    tokenId,
    tokenSpec: tokenSpec === 1 ? 'ERC721' : tokenSpec === 2 ? 'ERC1155' : 'UNKNOWN',
    lazy: contractData.token.lazy,
  }, null, 2));
  
  // Fetch metadata using our standard function
  console.log('\n📦 Fetching metadata using fetchNFTMetadata...');
  const metadata = await fetchNFTMetadata(tokenAddress, tokenId, tokenSpec);
  
  if (metadata) {
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    console.log('\n🖼️ Image URL from metadata:');
    console.log('metadata.image:', metadata.image);
  } else {
    console.log('❌ No metadata returned');
  }
  
  // Now let's fetch the tokenURI directly to see what the contract returns
  console.log('\n🔗 Fetching tokenURI directly from contract...');
  
  let tokenURI: string | null = null;
  try {
    if (tokenSpec === 1) {
      tokenURI = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC721_ABI,
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
    } else if (tokenSpec === 2) {
      tokenURI = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC1155_ABI,
        functionName: 'uri',
        args: [BigInt(tokenId)],
      });
    }
    
    console.log('tokenURI from contract:', tokenURI);
    
    // Fetch the metadata JSON directly
    if (tokenURI) {
      let metadataUrl = tokenURI;
      if (tokenURI.startsWith('ipfs://')) {
        metadataUrl = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (tokenURI.startsWith('ipfs/')) {
        metadataUrl = `https://ipfs.io/ipfs/${tokenURI.slice(5)}`;
      }
      
      console.log('\n📥 Fetching metadata from:', metadataUrl);
      const response = await fetch(metadataUrl);
      if (response.ok) {
        const rawMetadata = await response.json();
        console.log('\n📄 Raw Metadata JSON:');
        console.log(JSON.stringify(rawMetadata, null, 2));
        
        // Check if image is an IPFS directory
        if (rawMetadata.image) {
          console.log('\n🖼️ Image field analysis:');
          console.log('image value:', rawMetadata.image);
          console.log('is IPFS:', rawMetadata.image.startsWith('ipfs://') || rawMetadata.image.includes('/ipfs/'));
          
          // Try to list directory contents if it's an IPFS directory
          if (rawMetadata.image.startsWith('ipfs://') || rawMetadata.image.includes('/ipfs/')) {
            const imageHash = rawMetadata.image.replace('ipfs://', '').split('/ipfs/').pop()?.split('/')[0];
            if (imageHash) {
              console.log('\n📁 IPFS Hash:', imageHash);
              console.log('Attempting to check if this is a directory...');
              
              // Try to fetch directory listing (if it's a directory, this might return HTML or JSON)
              const dirUrl = `https://ipfs.io/ipfs/${imageHash}`;
              try {
                const dirResponse = await fetch(dirUrl);
                const contentType = dirResponse.headers.get('content-type');
                console.log('Directory URL content-type:', contentType);
                
                if (contentType?.includes('application/json')) {
                  const dirContents = await dirResponse.json();
                  console.log('Directory contents (JSON):', JSON.stringify(dirContents, null, 2));
                } else if (contentType?.includes('text/html')) {
                  const dirHtml = await dirResponse.text();
                  console.log('Directory appears to be HTML (might be a gateway directory listing)');
                  // Look for common image file patterns in HTML
                  const imagePatterns = /\.(jpg|jpeg|png|gif|webp|svg)/gi;
                  const matches = dirHtml.match(imagePatterns);
                  if (matches) {
                    console.log('Found image file extensions in HTML:', [...new Set(matches)]);
                  }
                } else {
                  // Try to fetch as image
                  const imageBuffer = await dirResponse.arrayBuffer();
                  console.log('Response is binary, size:', imageBuffer.byteLength, 'bytes');
                  console.log('This appears to be an image file, not a directory');
                }
              } catch (error) {
                console.log('Error checking directory:', error);
              }
              
              // Common image file names to try
              const commonImageNames = ['image', 'image.png', 'image.jpg', 'image.jpeg', '0', '1', 'token.png', 'token.jpg'];
              console.log('\n🔍 Trying common image file names in directory:');
              for (const fileName of commonImageNames) {
                const testUrl = `https://ipfs.io/ipfs/${imageHash}/${fileName}`;
                try {
                  const testResponse = await fetch(testUrl, { method: 'HEAD' });
                  if (testResponse.ok) {
                    const testContentType = testResponse.headers.get('content-type');
                    if (testContentType?.startsWith('image/')) {
                      console.log(`✅ Found: ${fileName} (${testContentType})`);
                    }
                  }
                } catch {
                  // Ignore errors
                }
              }
            }
          }
        }
      } else {
        console.error('Failed to fetch metadata:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('Error fetching tokenURI or metadata:', error);
  }
}

inspectListing53().catch(console.error);

