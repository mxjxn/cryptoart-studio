import { getNeynarClient } from './neynar';

const CRYPTOART_CONTRACT = process.env.CRYPTOART_HYPERSUB_CONTRACT!;

/**
 * Validates if a user has an active /cryptoart Hypersub membership
 * @param fid - The Farcaster ID to validate
 * @returns Promise<boolean> - True if user has active membership
 */
export async function validateCryptoArtMembership(fid: number): Promise<boolean> {
  try {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.warn('NEYNAR_API_KEY not configured - membership validation disabled');
      return false;
    }
    
    // Fetch user's active subscriptions
    const url = `https://api.neynar.com/v2/farcaster/user/subscribers?fid=${fid}&subscription_provider=fabric_stp`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch user subscriptions:', response.statusText);
      return false;
    }

    const data = await response.json();
    const subscriptions = data.subscribers || [];

    // Check if user has active subscription to /cryptoart contract
    const activeCryptoArtSubscription = subscriptions.find((sub: any) => {
      const subscription = sub.subscribed_to?.[0];
      if (!subscription) return false;
      
      // Check if subscription is to the /cryptoart contract and is still active
      const isCryptoArtContract = subscription.contract_address === CRYPTOART_CONTRACT;
      const isActive = new Date(subscription.expires_at) > new Date();
      
      return isCryptoArtContract && isActive;
    });

    return !!activeCryptoArtSubscription;
  } catch (error) {
    console.error('Error validating CryptoArt membership:', error);
    return false;
  }
}

/**
 * Middleware to validate CryptoArt membership for API endpoints
 * @param fid - The Farcaster ID to validate
 * @returns Promise<{ valid: boolean; error?: string }>
 */
export async function validateMembershipMiddleware(fid: number): Promise<{ valid: boolean; error?: string }> {
  if (!fid) {
    return { valid: false, error: 'FID is required' };
  }

  // Development bypass - skip membership validation if enabled
  const DEV_BYPASS_MEMBERSHIP = process.env.DEV_BYPASS_MEMBERSHIP === 'true';
  if (DEV_BYPASS_MEMBERSHIP) {
    console.log(`[DEV] Bypassing membership validation for FID ${fid}`);
    return { valid: true };
  }

  if (!CRYPTOART_CONTRACT) {
    return { valid: false, error: 'CryptoArt contract address not configured' };
  }

  const isValid = await validateCryptoArtMembership(fid);
  
  if (!isValid) {
    return { 
      valid: false, 
      error: 'Active /cryptoart Hypersub membership required' 
    };
  }

  return { valid: true };
}
