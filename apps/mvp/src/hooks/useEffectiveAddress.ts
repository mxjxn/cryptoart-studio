import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMiniApp } from '@neynar/react';
import { isAddress, type Address } from 'viem';

/**
 * Hook to get the effective wallet address for transactions.
 * 
 * In miniapp context: Uses verified_addresses.primary.eth_address from Farcaster
 * On web: Uses useAccount().address from standard web3 connector
 * 
 * This ensures transactions are signed by the correct wallet in each context.
 */
export function useEffectiveAddress(): {
  address: Address | undefined;
  isConnected: boolean;
  isMiniApp: boolean;
} {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { context } = useMiniApp();

  const result = useMemo(() => {
    // Check if we're in miniapp context
    const isMiniApp = !!context?.user;

    if (isMiniApp) {
      const user = context.user as any;
      
      // In miniapp: ALWAYS use primary verified address
      // This is the wallet that Farcaster uses for signing transactions
      const primaryAddress = user.verified_addresses?.primary?.eth_address;
      
      if (primaryAddress && isAddress(primaryAddress)) {
        return {
          address: primaryAddress.toLowerCase() as Address,
          isConnected: true,
          isMiniApp: true,
        };
      }
      
      // Fallback: If no primary, use first eth_address
      const ethAddresses = user.verified_addresses?.eth_addresses;
      if (Array.isArray(ethAddresses) && ethAddresses.length > 0) {
        const firstAddr = ethAddresses[0];
        if (isAddress(firstAddr)) {
          return {
            address: firstAddr.toLowerCase() as Address,
            isConnected: true,
            isMiniApp: true,
          };
        }
      }
      
      // Last resort: custody address (should rarely happen)
      const custodyAddress = user.custody_address;
      if (custodyAddress && isAddress(custodyAddress)) {
        console.warn('[useEffectiveAddress] Falling back to custody address - this may cause transaction issues');
        return {
          address: custodyAddress.toLowerCase() as Address,
          isConnected: true,
          isMiniApp: true,
        };
      }
      
      // No valid address found in miniapp context
      return {
        address: undefined,
        isConnected: false,
        isMiniApp: true,
      };
    }

    // On web: Use standard wagmi connector
    return {
      address: wagmiAddress,
      isConnected: wagmiConnected,
      isMiniApp: false,
    };
  }, [context?.user, wagmiAddress, wagmiConnected]);

  return result;
}


