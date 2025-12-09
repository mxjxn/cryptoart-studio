import { createWalletClient, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const AIRDROPPER_CONTRACT = '0x09350F89e2D7B6e96bA730783c2d76137B045FEF';

// ABI for the airdrop contract - this needs to be updated with the actual ABI
const AIRDROPPER_ABI = [
  {
    name: 'airdrop',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' }
    ],
    outputs: [],
  },
  {
    name: 'estimateGas',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' }
    ],
    outputs: [{ name: 'gasEstimate', type: 'uint256' }],
  },
] as const;

export interface AirdropParams {
  tokenAddress: string;
  recipients: string[];
  amounts: string[]; // Amounts as strings (in wei or token decimals)
}

export interface AirdropResult {
  txHash?: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  gasUsed?: string;
}

/**
 * Execute batch airdrop transaction
 * @param params - Airdrop parameters
 * @returns Promise<AirdropResult> - Transaction result
 */
export async function executeAirdrop(params: AirdropParams): Promise<AirdropResult> {
  try {
    const privateKey = process.env.AIRDROP_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('AIRDROP_WALLET_PRIVATE_KEY not configured');
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Validate inputs
    if (params.recipients.length !== params.amounts.length) {
      throw new Error('Recipients and amounts arrays must have the same length');
    }

    if (params.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Convert amounts to BigInt
    const amountsBigInt = params.amounts.map(amount => BigInt(amount));

    // Estimate gas first
    const gasEstimate = await publicClient.estimateContractGas({
      address: AIRDROPPER_CONTRACT as `0x${string}`,
      abi: AIRDROPPER_ABI,
      functionName: 'airdrop',
      args: [params.tokenAddress as `0x${string}`, params.recipients as readonly `0x${string}`[], amountsBigInt],
      account: account.address,
    });

    console.log('Gas estimate:', gasEstimate.toString());

    // Execute the airdrop transaction
    const hash = await walletClient.writeContract({
      address: AIRDROPPER_CONTRACT as `0x${string}`,
      abi: AIRDROPPER_ABI,
      functionName: 'airdrop',
      args: [params.tokenAddress as `0x${string}`, params.recipients as readonly `0x${string}`[], amountsBigInt],
      gas: gasEstimate,
    });

    console.log('Airdrop transaction submitted:', hash);

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      return {
        txHash: hash,
        status: 'success',
        gasUsed: receipt.gasUsed.toString(),
      };
    } else {
      return {
        txHash: hash,
        status: 'failed',
        error: 'Transaction failed',
      };
    }
  } catch (error) {
    console.error('Airdrop execution error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estimate gas cost for airdrop transaction
 * @param params - Airdrop parameters
 * @returns Promise<string> - Gas estimate as string
 */
export async function estimateAirdropGas(params: AirdropParams): Promise<string> {
  try {
    const privateKey = process.env.AIRDROP_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('AIRDROP_WALLET_PRIVATE_KEY not configured');
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });

    // Convert amounts to BigInt
    const amountsBigInt = params.amounts.map(amount => BigInt(amount));

    const gasEstimate = await publicClient.estimateContractGas({
      address: AIRDROPPER_CONTRACT as `0x${string}`,
      abi: AIRDROPPER_ABI,
      functionName: 'airdrop',
      args: [params.tokenAddress as `0x${string}`, params.recipients as readonly `0x${string}`[], amountsBigInt],
      account: account.address,
    });

    return gasEstimate.toString();
  } catch (error) {
    console.error('Gas estimation error:', error);
    throw error;
  }
}

/**
 * Validate airdrop parameters before execution
 * @param params - Airdrop parameters
 * @returns Promise<{ valid: boolean; errors: string[] }>
 */
export async function validateAirdropParams(params: AirdropParams): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Basic validation
  if (!params.tokenAddress) {
    errors.push('Token address is required');
  }

  if (!params.recipients || params.recipients.length === 0) {
    errors.push('At least one recipient is required');
  }

  if (!params.amounts || params.amounts.length === 0) {
    errors.push('At least one amount is required');
  }

  if (params.recipients.length !== params.amounts.length) {
    errors.push('Recipients and amounts arrays must have the same length');
  }

  // Validate addresses
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (params.tokenAddress && !addressRegex.test(params.tokenAddress)) {
    errors.push('Invalid token address format');
  }

  for (const recipient of params.recipients) {
    if (!addressRegex.test(recipient)) {
      errors.push(`Invalid recipient address: ${recipient}`);
    }
  }

  // Validate amounts
  for (const amount of params.amounts) {
    try {
      const amountBigInt = BigInt(amount);
      if (amountBigInt <= 0) {
        errors.push(`Amount must be greater than 0: ${amount}`);
      }
    } catch {
      errors.push(`Invalid amount format: ${amount}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
