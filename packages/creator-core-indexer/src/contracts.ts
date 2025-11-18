/**
 * Contract interaction utilities for Creator Core contracts
 */

import { createPublicClient, http, Address, isAddress } from 'viem';
import { base } from 'viem/chains';
import type { PublicClient } from 'viem';

// Minimal ABIs for detecting Creator Core contracts
export const ERC721_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'supportsInterface',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const ERC1155_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// Interface IDs
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC1155_INTERFACE_ID = '0xd9b67a26';
const ERC165_INTERFACE_ID = '0x01ffc9a7';

export interface ContractInfo {
  address: string;
  type: 'ERC721' | 'ERC1155' | 'ERC6551';
  name: string | null;
  symbol: string | null;
  owner: string | null;
  isUpgradeable: boolean;
  implementationAddress: string | null;
  proxyAdminAddress: string | null;
}

/**
 * Create viem public client
 */
export function createClient(rpcUrl: string, chainId: number): PublicClient {
  const chain = chainId === 8453 ? base : { id: chainId } as any;
  
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Detect if an address is a Creator Core contract
 */
export async function detectCreatorCoreContract(
  client: PublicClient,
  address: string
): Promise<ContractInfo | null> {
  if (!isAddress(address)) {
    return null;
  }

  try {
    // Check if contract supports ERC165
    const supportsERC165 = await client.readContract({
      address: address as Address,
      abi: ERC721_ABI,
      functionName: 'supportsInterface',
      args: [ERC165_INTERFACE_ID as `0x${string}`],
    }).catch(() => false);

    if (!supportsERC165) {
      return null;
    }

    // Check if it's ERC721
    const isERC721 = await client.readContract({
      address: address as Address,
      abi: ERC721_ABI,
      functionName: 'supportsInterface',
      args: [ERC721_INTERFACE_ID as `0x${string}`],
    }).catch(() => false);

    // Check if it's ERC1155
    const isERC1155 = await client.readContract({
      address: address as Address,
      abi: ERC1155_ABI,
      functionName: 'supportsInterface',
      args: [ERC1155_INTERFACE_ID as `0x${string}`],
    }).catch(() => false);

    if (!isERC721 && !isERC1155) {
      return null;
    }

    // Try to read name, symbol, owner
    const [name, symbol, owner] = await Promise.all([
      client.readContract({
        address: address as Address,
        abi: isERC721 ? ERC721_ABI : ERC1155_ABI,
        functionName: 'name',
      }).catch(() => null),
      client.readContract({
        address: address as Address,
        abi: isERC721 ? ERC721_ABI : ERC1155_ABI,
        functionName: 'symbol',
      }).catch(() => null),
      client.readContract({
        address: address as Address,
        abi: isERC721 ? ERC721_ABI : ERC1155_ABI,
        functionName: 'owner',
      }).catch(() => null),
    ]);

    return {
      address,
      type: isERC721 ? 'ERC721' : 'ERC1155',
      name: name || null,
      symbol: symbol || null,
      owner: owner || null,
      isUpgradeable: false, // TODO: Detect proxy pattern
      implementationAddress: null, // TODO: Detect implementation address
      proxyAdminAddress: null, // TODO: Detect proxy admin
    };
  } catch (error) {
    console.error(`Error detecting contract ${address}:`, error);
    return null;
  }
}

