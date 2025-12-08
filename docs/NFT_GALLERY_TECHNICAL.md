# NFT Gallery - Technical Implementation Guide

This document provides detailed technical guidance for implementing the NFT Gallery feature.

## Table of Contents
1. [Smart Contract Implementation](#smart-contract-implementation)
2. [Tokenbound Integration](#tokenbound-integration)
3. [Database Schema](#database-schema)
4. [API Implementation](#api-implementation)
5. [Frontend Components](#frontend-components)
6. [Arweave Integration](#arweave-integration)
7. [Testing Strategy](#testing-strategy)

---

## 1. Smart Contract Implementation

### Gallery NFT Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@tokenbound/contracts/interfaces/IERC6551Registry.sol";

interface IHypersub {
    function balanceOf(address account) external view returns (uint256);
}

contract GalleryNFT is ERC721, Ownable {
    // Constants
    uint256 public constant FULL_PRICE = 0.01 ether; // Example: $30
    uint256 public constant MEMBER_PRICE = 0.005 ether; // 50% discount: $15
    uint256 public constant MAX_CAPACITY = 20; // Max NFTs per gallery
    
    // State variables
    uint256 private _tokenIdCounter;
    address public hypersubContract; // Hypersub membership contract
    address public erc6551Registry; // Tokenbound registry
    address public erc6551Implementation; // TBA implementation
    
    // Token metadata
    mapping(uint256 => string) private _tokenURIs; // Arweave URIs
    mapping(uint256 => address) public tokenToTBA; // Token ID → TBA address
    mapping(uint256 => uint256) public galleryCapacity; // Max NFTs per gallery
    
    // Events
    event GalleryMinted(uint256 indexed tokenId, address indexed owner, address tba, uint256 price);
    event GalleryURIUpdated(uint256 indexed tokenId, string uri);
    
    constructor(
        address _hypersubContract,
        address _erc6551Registry,
        address _erc6551Implementation
    ) ERC721("Cryptoart Gallery", "GALLERY") Ownable(msg.sender) {
        hypersubContract = _hypersubContract;
        erc6551Registry = _erc6551Registry;
        erc6551Implementation = _erc6551Implementation;
    }
    
    /**
     * @notice Mint a new gallery NFT
     * @param capacity Max number of NFTs for this gallery (1-20)
     * @return tokenId The minted token ID
     * @return tbaAddress The created Tokenbound account address
     */
    function mintGallery(uint256 capacity) external payable returns (uint256, address) {
        require(capacity > 0 && capacity <= MAX_CAPACITY, "Invalid capacity");
        
        // Check membership and price
        bool isMember = IHypersub(hypersubContract).balanceOf(msg.sender) > 0;
        uint256 requiredPrice = isMember ? MEMBER_PRICE : FULL_PRICE;
        require(msg.value >= requiredPrice, "Insufficient payment");
        
        // Mint NFT
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(msg.sender, tokenId);
        galleryCapacity[tokenId] = capacity;
        
        // Create Tokenbound Account
        address tbaAddress = IERC6551Registry(erc6551Registry).createAccount(
            erc6551Implementation,
            block.chainid,
            address(this),
            tokenId,
            0, // salt
            "" // init data
        );
        
        tokenToTBA[tokenId] = tbaAddress;
        
        emit GalleryMinted(tokenId, msg.sender, tbaAddress, msg.value);
        
        // Refund excess payment
        if (msg.value > requiredPrice) {
            payable(msg.sender).transfer(msg.value - requiredPrice);
        }
        
        return (tokenId, tbaAddress);
    }
    
    /**
     * @notice Update gallery URI (Arweave link)
     * @param tokenId Gallery token ID
     * @param uri New URI (Arweave transaction ID)
     */
    function updateTokenURI(uint256 tokenId, string memory uri) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _tokenURIs[tokenId] = uri;
        emit GalleryURIUpdated(tokenId, uri);
    }
    
    /**
     * @notice Get token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        string memory uri = _tokenURIs[tokenId];
        if (bytes(uri).length > 0) {
            return string(abi.encodePacked("ar://", uri));
        }
        return "";
    }
    
    /**
     * @notice Withdraw contract balance (owner only)
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @notice Update Hypersub contract address (owner only)
     */
    function updateHypersubContract(address _hypersubContract) external onlyOwner {
        hypersubContract = _hypersubContract;
    }
}
```

### Gallery TBA Implementation (Restricted)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@tokenbound/contracts/AccountV3.sol";

/**
 * @title GalleryAccount
 * @notice Restricted Tokenbound Account for gallery NFTs
 * Only allows safe operations: deposit/eject NFTs, no arbitrary calls
 */
contract GalleryAccount is AccountV3 {
    // Whitelisted function selectors
    bytes4 private constant TRANSFER_FROM_721 = bytes4(keccak256("transferFrom(address,address,uint256)"));
    bytes4 private constant SAFE_TRANSFER_FROM_721 = bytes4(keccak256("safeTransferFrom(address,address,uint256)"));
    bytes4 private constant SAFE_TRANSFER_FROM_1155 = bytes4(keccak256("safeTransferFrom(address,address,uint256,uint256,bytes)"));
    
    /**
     * @notice Override execute to restrict operations
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) public payable override returns (bytes memory) {
        // Only allow calls to ERC721/ERC1155 contracts for transfer operations
        require(_isWhitelistedOperation(to, data), "Operation not allowed");
        return super.execute(to, value, data, operation);
    }
    
    /**
     * @notice Check if operation is whitelisted
     */
    function _isWhitelistedOperation(address to, bytes calldata data) private pure returns (bool) {
        if (data.length < 4) return false;
        
        bytes4 selector = bytes4(data[:4]);
        
        // Allow ERC721 and ERC1155 transfers only
        return selector == TRANSFER_FROM_721 || 
               selector == SAFE_TRANSFER_FROM_721 || 
               selector == SAFE_TRANSFER_FROM_1155;
    }
}
```

---

## 2. Tokenbound Integration

### SDK Setup

```typescript
// lib/tokenbound/client.ts
import { TokenboundClient } from '@tokenbound/sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

export function createTokenboundClient(walletClient: any) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  return new TokenboundClient({
    chain: base,
    publicClient,
    walletClient,
  });
}

export async function getTBAAddress(
  tokenContract: `0x${string}`,
  tokenId: string
): Promise<`0x${string}`> {
  const client = createTokenboundClient(null);
  return await client.getAccount({
    tokenContract,
    tokenId,
  });
}

export async function getTBABalance(tbaAddress: `0x${string}`) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });
  return await publicClient.getBalance({ address: tbaAddress });
}
```

### Deposit NFT Helper

```typescript
// lib/tokenbound/operations.ts
export async function depositNFTToGallery(
  walletClient: any,
  nftContract: `0x${string}`,
  tokenId: string,
  tbaAddress: `0x${string}`,
  userAddress: `0x${string}`
) {
  const tokenType = await detectTokenType(nftContract);
  
  if (tokenType === 'ERC721') {
    return await walletClient.writeContract({
      address: nftContract,
      abi: ERC721_ABI,
      functionName: 'safeTransferFrom',
      args: [userAddress, tbaAddress, BigInt(tokenId)],
    });
  } else if (tokenType === 'ERC1155') {
    return await walletClient.writeContract({
      address: nftContract,
      abi: ERC1155_ABI,
      functionName: 'safeTransferFrom',
      args: [userAddress, tbaAddress, BigInt(tokenId), 1n, '0x'],
    });
  }
  
  throw new Error('Unsupported token type');
}

export async function ejectNFTFromGallery(
  tokenbound: TokenboundClient,
  nftContract: `0x${string}`,
  tokenId: string,
  toAddress: `0x${string}`,
  tbaAddress: `0x${string}`
) {
  const tokenType = await detectTokenType(nftContract);
  
  if (tokenType === 'ERC721') {
    return await tokenbound.executeCall({
      account: tbaAddress,
      to: nftContract,
      value: 0n,
      data: encodeFunctionData({
        abi: ERC721_ABI,
        functionName: 'safeTransferFrom',
        args: [tbaAddress, toAddress, BigInt(tokenId)],
      }),
    });
  } else if (tokenType === 'ERC1155') {
    return await tokenbound.executeCall({
      account: tbaAddress,
      to: nftContract,
      value: 0n,
      data: encodeFunctionData({
        abi: ERC1155_ABI,
        functionName: 'safeTransferFrom',
        args: [tbaAddress, toAddress, BigInt(tokenId), 1n, '0x'],
      }),
    });
  }
}

async function detectTokenType(contract: `0x${string}`): Promise<'ERC721' | 'ERC1155'> {
  // Use ERC165 supportsInterface or other detection method
  // Implementation depends on your needs
  return 'ERC721'; // Placeholder
}
```

---

## 3. Database Schema

### Drizzle Schema

```typescript
// packages/db/src/schema.ts (additions)

export const galleries = pgTable('galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenId: bigint('token_id', { mode: 'number' }).notNull().unique(),
  contractAddress: text('contract_address').notNull(),
  ownerAddress: text('owner_address').notNull(),
  tbaAddress: text('tba_address').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull().default(10),
  currentCount: integer('current_count').notNull().default(0),
  arweaveId: text('arweave_id'),
  arweaveUrl: text('arweave_url'),
  theme: text('theme').default('default'),
  isPublic: boolean('is_public').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerIdx: index('galleries_owner_idx').on(table.ownerAddress),
  tbaIdx: index('galleries_tba_idx').on(table.tbaAddress),
}));

export const galleryNfts = pgTable('gallery_nfts', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull().references(() => galleries.id, { onDelete: 'cascade' }),
  contractAddress: text('contract_address').notNull(),
  tokenId: text('token_id').notNull(),
  tokenType: text('token_type').notNull(), // 'ERC721' | 'ERC1155'
  amount: integer('amount').default(1),
  position: integer('position').notNull(),
  name: text('name'),
  description: text('description'),
  imageUrl: text('image_url'),
  metadata: jsonb('metadata'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => ({
  galleryIdx: index('gallery_nfts_gallery_idx').on(table.galleryId),
  uniqueNft: index('gallery_nfts_unique_idx').on(
    table.galleryId,
    table.contractAddress,
    table.tokenId
  ),
  positionIdx: index('gallery_nfts_position_idx').on(table.galleryId, table.position),
}));

export const galleryStats = pgTable('gallery_stats', {
  galleryId: uuid('gallery_id').primaryKey().references(() => galleries.id, { onDelete: 'cascade' }),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  shares: integer('shares').default(0),
  lastViewedAt: timestamp('last_viewed_at'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
});

// Type exports
export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;
export type GalleryNFT = typeof galleryNfts.$inferSelect;
export type NewGalleryNFT = typeof galleryNfts.$inferInsert;
export type GalleryStats = typeof galleryStats.$inferSelect;
```

---

## 4. API Implementation

### Mint Gallery Endpoint

```typescript
// app/api/gallery/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, galleries } from '@cryptoart/db';
import { verifyMessage } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const { 
      ownerAddress, 
      signature, 
      name, 
      description, 
      capacity,
      tokenId,
      tbaAddress,
      contractAddress,
      txHash 
    } = await req.json();
    
    // Verify signature (SIWE or similar)
    const isValid = await verifyMessage({
      address: ownerAddress,
      message: `Mint Gallery: ${name}`,
      signature,
    });
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Create gallery record
    const db = getDatabase();
    const [gallery] = await db.insert(galleries).values({
      tokenId: BigInt(tokenId),
      contractAddress,
      ownerAddress,
      tbaAddress,
      name,
      description,
      capacity: capacity || 10,
      currentCount: 0,
    }).returning();
    
    // Initialize stats
    await db.insert(galleryStats).values({
      galleryId: gallery.id,
      views: 0,
      likes: 0,
    });
    
    return NextResponse.json({ 
      success: true, 
      gallery,
      txHash 
    });
  } catch (error) {
    console.error('Mint gallery error:', error);
    return NextResponse.json({ 
      error: 'Failed to mint gallery' 
    }, { status: 500 });
  }
}
```

### Deposit NFT Endpoint

```typescript
// app/api/gallery/[id]/deposit/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { 
      nftContract, 
      tokenId, 
      tokenType,
      txHash,
      metadata 
    } = await req.json();
    
    const db = getDatabase();
    
    // Get gallery and verify not at capacity
    const [gallery] = await db
      .select()
      .from(galleries)
      .where(eq(galleries.id, params.id));
    
    if (!gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
    }
    
    if (gallery.currentCount >= gallery.capacity) {
      return NextResponse.json({ error: 'Gallery at capacity' }, { status: 400 });
    }
    
    // Verify NFT is actually in TBA (on-chain verification)
    const isInTBA = await verifyNFTInTBA(
      gallery.tbaAddress, 
      nftContract, 
      tokenId, 
      tokenType
    );
    
    if (!isInTBA) {
      return NextResponse.json({ 
        error: 'NFT not found in gallery wallet' 
      }, { status: 400 });
    }
    
    // Get next position
    const maxPosition = await db
      .select({ max: sql<number>`MAX(position)` })
      .from(galleryNfts)
      .where(eq(galleryNfts.galleryId, params.id));
    
    const nextPosition = (maxPosition[0]?.max || -1) + 1;
    
    // Add NFT to gallery
    const [nft] = await db.insert(galleryNfts).values({
      galleryId: params.id,
      contractAddress: nftContract,
      tokenId,
      tokenType,
      position: nextPosition,
      name: metadata?.name,
      description: metadata?.description,
      imageUrl: metadata?.image,
      metadata,
    }).returning();
    
    // Update gallery count
    await db
      .update(galleries)
      .set({ 
        currentCount: sql`${galleries.currentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(galleries.id, params.id));
    
    return NextResponse.json({ success: true, nft });
  } catch (error) {
    console.error('Deposit NFT error:', error);
    return NextResponse.json({ 
      error: 'Failed to deposit NFT' 
    }, { status: 500 });
  }
}

async function verifyNFTInTBA(
  tbaAddress: string,
  nftContract: string,
  tokenId: string,
  tokenType: string
): Promise<boolean> {
  // Use viem to check on-chain ownership
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });
  
  if (tokenType === 'ERC721') {
    const owner = await publicClient.readContract({
      address: nftContract as `0x${string}`,
      abi: ERC721_ABI,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    });
    return owner.toLowerCase() === tbaAddress.toLowerCase();
  } else {
    const balance = await publicClient.readContract({
      address: nftContract as `0x${string}`,
      abi: ERC1155_ABI,
      functionName: 'balanceOf',
      args: [tbaAddress as `0x${string}`, BigInt(tokenId)],
    });
    return balance > 0n;
  }
}
```

---

## 5. Frontend Components

### Gallery Viewer Component

```typescript
// components/gallery/GalleryViewer.tsx
'use client';

import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Zoom, EffectCube } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/zoom';

interface GalleryViewerProps {
  gallery: Gallery;
  nfts: GalleryNFT[];
}

export function GalleryViewer({ gallery, nfts }: GalleryViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  
  const currentNFT = nfts[activeIndex];
  
  return (
    <div className="gallery-viewer h-screen flex flex-col">
      {/* Header */}
      <div className="gallery-header p-4 bg-black/50 backdrop-blur">
        <h1 className="text-2xl font-bold">{gallery.name}</h1>
        <p className="text-sm text-gray-400">
          {activeIndex + 1} / {nfts.length}
        </p>
      </div>
      
      {/* Main Swiper */}
      <div className="flex-1 relative">
        <Swiper
          modules={[Navigation, Zoom, EffectCube]}
          navigation
          zoom
          effect="cube"
          onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
          className="h-full"
        >
          {nfts.map((nft, index) => (
            <SwiperSlide key={nft.id}>
              <div className="swiper-zoom-container">
                <img
                  src={nft.imageUrl || '/placeholder.png'}
                  alt={nft.name || `NFT ${index + 1}`}
                  className="w-full h-full object-contain"
                  onClick={() => setShowDetails(!showDetails)}
                />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      
      {/* Details Panel (Swipe Up) */}
      <div 
        className={`details-panel absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur transform transition-transform ${
          showDetails ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '50vh' }}
      >
        <div className="p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-2">{currentNFT?.name}</h2>
          <p className="text-gray-400 mb-4">{currentNFT?.description}</p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Contract:</span>
              <p className="font-mono">{currentNFT?.contractAddress.slice(0, 10)}...</p>
            </div>
            <div>
              <span className="text-gray-500">Token ID:</span>
              <p className="font-mono">{currentNFT?.tokenId}</p>
            </div>
          </div>
          
          {/* Listing Info (if available) */}
          {currentNFT?.metadata?.listings && (
            <div className="mt-4 p-4 bg-blue-500/20 rounded">
              <h3 className="font-bold mb-2">Available for Sale</h3>
              {/* Render listing details */}
            </div>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(false)}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Arweave Integration

### Arweave Client

```typescript
// lib/arweave/client.ts
import Arweave from 'arweave';
import { readFileSync } from 'fs';

export class ArweaveClient {
  private arweave: Arweave;
  private wallet: any;
  
  constructor() {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
    });
    
    // Load wallet from env
    const walletKey = process.env.ARWEAVE_WALLET_KEY;
    if (walletKey) {
      this.wallet = JSON.parse(walletKey);
    }
  }
  
  async uploadHTML(html: string): Promise<string> {
    const transaction = await this.arweave.createTransaction({
      data: html,
    }, this.wallet);
    
    transaction.addTag('Content-Type', 'text/html');
    transaction.addTag('App-Name', 'Cryptoart Gallery');
    
    await this.arweave.transactions.sign(transaction, this.wallet);
    await this.arweave.transactions.post(transaction);
    
    return transaction.id;
  }
  
  async uploadJSON(data: any): Promise<string> {
    const transaction = await this.arweave.createTransaction({
      data: JSON.stringify(data),
    }, this.wallet);
    
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'Cryptoart Gallery');
    
    await this.arweave.transactions.sign(transaction, this.wallet);
    await this.arweave.transactions.post(transaction);
    
    return transaction.id;
  }
  
  getURL(txId: string): string {
    return `https://arweave.net/${txId}`;
  }
}
```

### HTML Template Generator

```typescript
// lib/arweave/template.ts
export function generateGalleryHTML(
  gallery: Gallery,
  nfts: GalleryNFT[]
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${gallery.name} - Cryptoart Gallery</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #000;
      color: #fff;
    }
    .gallery {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .gallery-header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
    }
    .nft-card {
      background: #111;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s;
    }
    .nft-card:hover {
      transform: scale(1.05);
    }
    .nft-image {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
    }
    .nft-info {
      padding: 1rem;
    }
  </style>
</head>
<body>
  <div class="gallery">
    <div class="gallery-header">
      <h1>${gallery.name}</h1>
      <p>${gallery.description || ''}</p>
      <p>Curated by ${gallery.ownerAddress.slice(0, 6)}...${gallery.ownerAddress.slice(-4)}</p>
    </div>
    
    <div class="gallery-grid">
      ${nfts.map(nft => `
        <div class="nft-card">
          <img class="nft-image" src="${nft.imageUrl}" alt="${nft.name}" />
          <div class="nft-info">
            <h3>${nft.name || 'Untitled'}</h3>
            <p>${nft.description || ''}</p>
            <small>${nft.contractAddress.slice(0, 10)}...#${nft.tokenId}</small>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <script>
    // Add interactivity (swipe, zoom, etc.)
  </script>
</body>
</html>
  `.trim();
}
```

---

## 7. Testing Strategy

### Smart Contract Tests (Foundry)

```solidity
// test/GalleryNFT.t.sol
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GalleryNFT.sol";

contract GalleryNFTTest is Test {
    GalleryNFT public gallery;
    address public hypersub = address(0x123);
    address public registry = address(0x456);
    address public implementation = address(0x789);
    
    function setUp() public {
        gallery = new GalleryNFT(hypersub, registry, implementation);
    }
    
    function testMintGallery() public {
        vm.deal(address(this), 1 ether);
        
        (uint256 tokenId, address tba) = gallery.mintGallery{value: 0.01 ether}(10);
        
        assertEq(gallery.ownerOf(tokenId), address(this));
        assertEq(gallery.tokenToTBA(tokenId), tba);
        assertEq(gallery.galleryCapacity(tokenId), 10);
    }
    
    function testMemberDiscount() public {
        // Mock hypersub balanceOf to return > 0
        vm.mockCall(
            hypersub,
            abi.encodeWithSelector(IHypersub.balanceOf.selector, address(this)),
            abi.encode(1)
        );
        
        vm.deal(address(this), 1 ether);
        
        // Should succeed with member price
        gallery.mintGallery{value: 0.005 ether}(10);
        
        // Should fail with less than member price
        vm.expectRevert("Insufficient payment");
        gallery.mintGallery{value: 0.004 ether}(10);
    }
}
```

### Frontend Tests

```typescript
// __tests__/GalleryViewer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryViewer } from '@/components/gallery/GalleryViewer';

describe('GalleryViewer', () => {
  const mockGallery = {
    id: '1',
    name: 'Test Gallery',
    description: 'A test gallery',
    // ...
  };
  
  const mockNFTs = [
    { id: '1', name: 'NFT 1', imageUrl: '/img1.png', /* ... */ },
    { id: '2', name: 'NFT 2', imageUrl: '/img2.png', /* ... */ },
  ];
  
  it('renders gallery with NFTs', () => {
    render(<GalleryViewer gallery={mockGallery} nfts={mockNFTs} />);
    
    expect(screen.getByText('Test Gallery')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });
  
  it('shows details on image click', () => {
    render(<GalleryViewer gallery={mockGallery} nfts={mockNFTs} />);
    
    const image = screen.getByAltText('NFT 1');
    fireEvent.click(image);
    
    expect(screen.getByText('NFT 1')).toBeVisible();
  });
});
```

---

## Development Checklist

### Phase 1: Foundation
- [ ] Set up such-gallery Next.js app
- [ ] Install dependencies (@tokenbound/sdk, arweave, etc.)
- [ ] Deploy smart contracts to testnet
- [ ] Create database migrations
- [ ] Set up Arweave client
- [ ] Write unit tests for contracts

### Phase 2: Core Features
- [ ] Implement mint gallery flow (frontend + backend)
- [ ] Build NFT deposit/eject functionality
- [ ] Create gallery viewer (basic)
- [ ] Add membership check integration
- [ ] Test on testnet

### Phase 3: Advanced UI
- [ ] Implement swipe navigation
- [ ] Add zoom functionality
- [ ] Create details panel
- [ ] Build gallery management UI
- [ ] Add browse/discover page

### Phase 4: Launch
- [ ] Generate and upload HTML to Arweave
- [ ] Update token URIs
- [ ] E2E testing
- [ ] Deploy to mainnet
- [ ] Write documentation

---

*For questions or issues, refer to the main [NFT_GALLERY_PLAN.md](./NFT_GALLERY_PLAN.md).*
