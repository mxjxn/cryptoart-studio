import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { CONTRACT_INFO_ABI } from "~/lib/contract-info";
import { fetchContractInfoFromAlchemy } from "~/lib/contract-info";

/**
 * Server-side contract name fetching.
 * Matches the logic from useContractName hook.
 * 
 * @param contractAddress - The contract address to query
 * @returns Contract name or null if not found
 */
export async function getContractNameServer(
  contractAddress: string
): Promise<string | null> {
  console.log(`[OG Image] [getContractNameServer] Fetching contract name for ${contractAddress}...`);
  
  if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    console.warn(`[OG Image] [getContractNameServer] Invalid contract address: ${contractAddress}`);
    return null;
  }

  const address = contractAddress as Address;

  // Try on-chain name() function first
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(
        process.env.RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"
      ),
    });

    const name = await publicClient.readContract({
      address,
      abi: CONTRACT_INFO_ABI,
      functionName: "name",
    });

    if (name && typeof name === "string" && name.trim() !== "") {
      console.log(`[OG Image] [getContractNameServer] Found contract name: ${name}`);
      return name;
    }
    console.log(`[OG Image] [getContractNameServer] Contract name() returned empty or invalid`);
  } catch (error) {
    // Contract may not have name() function - try Alchemy fallback
    console.log(
      `[OG Image] [getContractNameServer] On-chain name() failed for ${contractAddress}, trying Alchemy fallback:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  // Fallback to Alchemy API if available
  try {
    console.log(`[OG Image] [getContractNameServer] Trying Alchemy API fallback...`);
    const alchemyInfo = await fetchContractInfoFromAlchemy(contractAddress);
    if (alchemyInfo?.name) {
      console.log(`[OG Image] [getContractNameServer] Found contract name via Alchemy: ${alchemyInfo.name}`);
      return alchemyInfo.name;
    }
    console.log(`[OG Image] [getContractNameServer] Alchemy lookup returned no name`);
  } catch (error) {
    console.log(
      `[OG Image] [getContractNameServer] Alchemy lookup failed for ${contractAddress}:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  console.log(`[OG Image] [getContractNameServer] No contract name found for ${contractAddress}`);
  return null;
}

