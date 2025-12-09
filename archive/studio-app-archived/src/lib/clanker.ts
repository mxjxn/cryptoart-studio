/**
 * Clanker API integration for fetching user tokens
 * Based on Clanker SDK v4.0.0 documentation
 */

export interface ClankerToken {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  description?: string;
  deployedAt: string;
  chain: number;
  metadata?: {
    description?: string;
    socialMediaUrls?: string[];
    auditUrls?: string[];
  };
  context?: {
    interface: string;
    platform: string;
    messageId: string;
    id: string;
  };
}

/**
 * Fetch tokens launched by a user via Clanker
 * @param fid - The Farcaster ID to fetch tokens for
 * @returns Promise<ClankerToken[]> - Array of deployed tokens
 */
export async function getClankerTokens(fid: number): Promise<ClankerToken[]> {
  try {
    // Note: This is a placeholder implementation
    // The actual Clanker API endpoint for fetching user tokens needs to be determined
    // Based on the SDK docs, we would need to query their API for tokens deployed by this FID
    
    const response = await fetch(`https://api.clanker.world/tokens/user/${fid}`, {
      headers: {
        'Accept': 'application/json',
        // Add any required authentication headers if needed
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Clanker tokens:', response.statusText);
      return [];
    }

    const data = await response.json();
    
    // Transform the API response to our ClankerToken format
    return (data.tokens || []).map((token: any) => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      image: token.image,
      description: token.description,
      deployedAt: token.deployed_at,
      chain: token.chain,
      metadata: token.metadata,
      context: token.context,
    }));
  } catch (error) {
    console.error('Error fetching Clanker tokens:', error);
    return [];
  }
}

/**
 * Get token details by contract address
 * @param tokenAddress - The token contract address
 * @returns Promise<ClankerToken | null> - Token details or null if not found
 */
export async function getClankerTokenByAddress(tokenAddress: string): Promise<ClankerToken | null> {
  try {
    const response = await fetch(`https://api.clanker.world/tokens/${tokenAddress}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const token = await response.json();
    
    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      image: token.image,
      description: token.description,
      deployedAt: token.deployed_at,
      chain: token.chain,
      metadata: token.metadata,
      context: token.context,
    };
  } catch (error) {
    console.error('Error fetching Clanker token by address:', error);
    return null;
  }
}

/**
 * Check if a token was deployed via Clanker
 * @param tokenAddress - The token contract address to check
 * @returns Promise<boolean> - True if token was deployed via Clanker
 */
export async function isClankerToken(tokenAddress: string): Promise<boolean> {
  const token = await getClankerTokenByAddress(tokenAddress);
  return token !== null;
}
