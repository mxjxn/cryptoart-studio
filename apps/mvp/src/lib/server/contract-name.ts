import { createPublicClient, http, type Address } from "viem";
import { base, mainnet } from "viem/chains";
import { CHAIN_ID } from "~/lib/contracts/marketplace";
import { CONTRACT_INFO_ABI, fetchContractInfoFromAlchemy } from "~/lib/contract-info";

export type GetContractNameServerOptions = {
  /** Chain where the NFT contract is deployed (`1` = Ethereum, `8453` = Base). Defaults to app Base. */
  chainId?: number;
};

/**
 * Server-side contract name fetching (on-chain `name()` + Alchemy).
 * Used by OG routes and anywhere else that needs chain-scoped names (on-chain + Alchemy).
 */
export async function getContractNameServer(
  contractAddress: string,
  options?: GetContractNameServerOptions
): Promise<string | null> {
  const chainId = options?.chainId ?? CHAIN_ID;
  const onMainnet = chainId === 1;

  console.log(
    `[OG Image] [getContractNameServer] Fetching contract name for ${contractAddress} (chainId=${chainId})...`
  );

  if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
    console.warn(`[OG Image] [getContractNameServer] Invalid contract address: ${contractAddress}`);
    return null;
  }

  const address = contractAddress as Address;

  try {
    const publicClient = createPublicClient({
      chain: onMainnet ? mainnet : base,
      transport: http(
        onMainnet
          ? process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://eth.llamarpc.com"
          : process.env.NEXT_PUBLIC_RPC_URL ||
            process.env.RPC_URL ||
            process.env.NEXT_PUBLIC_BASE_RPC_URL ||
            "https://mainnet.base.org"
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
    console.log(
      `[OG Image] [getContractNameServer] On-chain name() failed for ${contractAddress}, trying Alchemy fallback:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  try {
    console.log(`[OG Image] [getContractNameServer] Trying Alchemy API fallback (chainId=${chainId})...`);
    const alchemyInfo = await fetchContractInfoFromAlchemy(contractAddress, chainId);
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
