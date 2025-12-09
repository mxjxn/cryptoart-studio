import { useState } from 'react';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { TREASURY_ADDRESS, USDC_ADDRESSES } from '@/lib/config/payment';

export type UploadStatus = 'idle' | 'quoting' | 'quote_ready' | 'paying' | 'uploading' | 'complete' | 'error';

export interface UploadQuote {
  estimatedPriceUSDC: number;
  arPriceUSD: number;
  uploadCostAR: number;
  quoteId: string;
}

export function useArweaveUpload() {
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [quote, setQuote] = useState<UploadQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arweaveUrl, setArweaveUrl] = useState<string | null>(null);

  const getQuote = async (file: File) => {
    try {
      setStatus('quoting');
      setError(null);
      
      const res = await fetch('/api/studio/upload/quote', {
        method: 'POST',
        body: JSON.stringify({ fileSize: file.size }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error('Failed to get quote');
      
      const data = await res.json();
      setQuote(data);
      setStatus('quote_ready');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quote failed');
      setStatus('error');
    }
  };

  const payAndUpload = async (file: File) => {
    if (!quote) return;
    
    try {
      setStatus('paying');
      setError(null);

      // 1. Ensure correct chain
      // Default logic: 
      // If connected to Base (8453), use it.
      // If connected to Base Sepolia (84532), use it.
      // Else, try to switch to Base Sepolia (safe default for dev/testing, but production might want Base).
      // Since we don't have a global "Environment" switch exposed here easily, we'll favor Base Sepolia if chain is unknown/unsupported
      // unless we are explicit.
      
      let targetChainId = chain?.id;
      if (targetChainId !== 8453 && targetChainId !== 84532) {
          // Force switch to Base Sepolia for now as a safe default or ask user?
          // Let's assume user is on the right network or we prompt.
          // For this implementation, let's default to Base Sepolia if undefined.
          targetChainId = 84532;
          if (switchChainAsync) {
            try {
                await switchChainAsync({ chainId: targetChainId });
            } catch (e) {
                throw new Error('Please switch to Base Sepolia or Base Mainnet');
            }
          }
      }

      const usdcAddress = USDC_ADDRESSES[targetChainId as number];
      if (!usdcAddress) {
          throw new Error('Unsupported chain');
      }

      // 2. Send USDC
      // Use toFixed(6) to ensure we don't have too many decimals for parseUnits
      const amountString = quote.estimatedPriceUSDC.toFixed(6);
      const amount = parseUnits(amountString, 6); 
      
      const txHash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [TREASURY_ADDRESS, amount],
        chainId: targetChainId
      });

      setStatus('uploading');
      
      // 3. Upload to API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('txHash', txHash);
      formData.append('chainId', targetChainId!.toString());

      const res = await fetch('/api/studio/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setArweaveUrl(data.arweaveUrl);
      setStatus('complete');
      return data.arweaveUrl;

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Payment or upload failed');
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setQuote(null);
    setError(null);
    setArweaveUrl(null);
  }

  return {
    status,
    quote,
    error,
    arweaveUrl,
    getQuote,
    payAndUpload,
    reset
  };
}

