import { useReadContracts, useBalance } from "wagmi";
import { type Address, isAddress, zeroAddress } from "viem";
import { useMemo } from "react";
import { CHAIN_ID } from "~/lib/contracts/marketplace";

// Standard ERC20 ABI for the functions we need
const ERC20_ABI = [
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface ERC20TokenData {
  address: Address;
  name: string | null;
  symbol: string | null;
  decimals: number;
  isValid: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ERC20BalanceData {
  balance: bigint;
  formatted: string;
  isLoading: boolean;
}

/**
 * Check if an address represents ETH (zero address or undefined)
 */
export function isETH(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return true;
  return tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
}

/**
 * Hook to fetch ERC20 token information (name, symbol, decimals)
 * Returns null data if the address is invalid or the zero address (ETH)
 */
export function useERC20Token(tokenAddress: string | undefined): ERC20TokenData {
  const isValidAddress = tokenAddress && isAddress(tokenAddress) && !isETH(tokenAddress);
  const address = isValidAddress ? (tokenAddress as Address) : undefined;

  const { data, isLoading, isError, error } = useReadContracts({
    contracts: address
      ? [
          {
            address,
            abi: ERC20_ABI,
            functionName: "name",
            chainId: CHAIN_ID,
          },
          {
            address,
            abi: ERC20_ABI,
            functionName: "symbol",
            chainId: CHAIN_ID,
          },
          {
            address,
            abi: ERC20_ABI,
            functionName: "decimals",
            chainId: CHAIN_ID,
          },
        ]
      : undefined,
    query: {
      enabled: !!address,
      retry: 1,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    },
  });

  return useMemo(() => {
    if (!isValidAddress) {
      return {
        address: zeroAddress,
        name: null,
        symbol: null,
        decimals: 18,
        isValid: false,
        isLoading: false,
        error: tokenAddress && !isAddress(tokenAddress) ? "Invalid address format" : null,
      };
    }

    if (isLoading) {
      return {
        address: address!,
        name: null,
        symbol: null,
        decimals: 18,
        isValid: false,
        isLoading: true,
        error: null,
      };
    }

    if (isError || !data) {
      return {
        address: address!,
        name: null,
        symbol: null,
        decimals: 18,
        isValid: false,
        isLoading: false,
        error: "Failed to fetch token info. Is this a valid ERC20 token?",
      };
    }

    const [nameResult, symbolResult, decimalsResult] = data;
    
    // Check if all calls succeeded
    const hasName = nameResult.status === "success" && typeof nameResult.result === "string";
    const hasSymbol = symbolResult.status === "success" && typeof symbolResult.result === "string";
    const hasDecimals = decimalsResult.status === "success" && typeof decimalsResult.result === "number";

    if (!hasName || !hasSymbol) {
      return {
        address: address!,
        name: hasName ? (nameResult.result as string) : null,
        symbol: hasSymbol ? (symbolResult.result as string) : null,
        decimals: hasDecimals ? (decimalsResult.result as number) : 18,
        isValid: false,
        isLoading: false,
        error: "Not a valid ERC20 token (missing name or symbol)",
      };
    }

    return {
      address: address!,
      name: nameResult.result as string,
      symbol: symbolResult.result as string,
      decimals: hasDecimals ? (decimalsResult.result as number) : 18,
      isValid: true,
      isLoading: false,
      error: null,
    };
  }, [isValidAddress, address, tokenAddress, isLoading, isError, data]);
}

/**
 * Hook to fetch a user's balance of an ERC20 token
 * Also works for ETH when tokenAddress is zero address or undefined
 */
export function useERC20Balance(
  tokenAddress: string | undefined,
  userAddress: Address | undefined
): ERC20BalanceData {
  const isNativeETH = isETH(tokenAddress);
  const isValidToken = tokenAddress && isAddress(tokenAddress) && !isNativeETH;
  const address = isValidToken ? (tokenAddress as Address) : undefined;

  // Fetch ETH balance
  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address: userAddress,
    chainId: CHAIN_ID,
    query: {
      enabled: isNativeETH && !!userAddress,
    },
  });

  // Fetch ERC20 balance
  const { data: tokenBalanceData, isLoading: tokenLoading } = useReadContracts({
    contracts: address && userAddress
      ? [
          {
            address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [userAddress],
            chainId: CHAIN_ID,
          },
          {
            address,
            abi: ERC20_ABI,
            functionName: "decimals",
            chainId: CHAIN_ID,
          },
        ]
      : undefined,
    query: {
      enabled: !!address && !!userAddress,
      retry: 1,
    },
  });

  return useMemo(() => {
    if (isNativeETH) {
      return {
        balance: ethBalance?.value ?? BigInt(0),
        formatted: ethBalance?.formatted ?? "0",
        isLoading: ethLoading,
      };
    }

    if (!isValidToken || !tokenBalanceData) {
      return {
        balance: BigInt(0),
        formatted: "0",
        isLoading: tokenLoading,
      };
    }

    const [balanceResult, decimalsResult] = tokenBalanceData;
    const balance = balanceResult.status === "success" ? (balanceResult.result as bigint) : BigInt(0);
    const decimals = decimalsResult.status === "success" ? (decimalsResult.result as number) : 18;
    
    // Format the balance
    const formatted = formatTokenBalance(balance, decimals);

    return {
      balance,
      formatted,
      isLoading: tokenLoading,
    };
  }, [isNativeETH, isValidToken, ethBalance, ethLoading, tokenBalanceData, tokenLoading]);
}

/**
 * Format a token balance with proper decimal places
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === BigInt(0)) return "0";
  
  const divisor = BigInt(10 ** decimals);
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;
  
  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }
  
  // Format fractional part with leading zeros
  let fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Remove trailing zeros
  fractionalStr = fractionalStr.replace(/0+$/, "");
  
  // Limit to 6 decimal places for display
  if (fractionalStr.length > 6) {
    fractionalStr = fractionalStr.slice(0, 6);
  }
  
  return `${wholePart}.${fractionalStr}`;
}

/**
 * Format a price amount for display with token symbol
 */
export function formatPriceWithSymbol(
  amount: string | bigint,
  tokenAddress: string | undefined,
  symbol: string | undefined | null,
  decimals: number = 18
): { value: string; symbol: string } {
  const amountBigInt = typeof amount === "string" ? BigInt(amount) : amount;
  const formatted = formatTokenBalance(amountBigInt, decimals);
  
  if (isETH(tokenAddress)) {
    return { value: formatted, symbol: "ETH" };
  }
  
  return { value: formatted, symbol: symbol || "$TOKEN" };
}
