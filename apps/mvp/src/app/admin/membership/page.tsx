'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { STP_V2_CONTRACT_ADDRESS } from '~/lib/constants';

// STP v2 ABI for revokeTime function
const STP_V2_REVOKE_ABI = [
  {
    name: 'revokeTime',
    type: 'function',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'numSeconds', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export default function MembershipPage() {
  const { address: adminAddress } = useAccount();
  const [addressToRevoke, setAddressToRevoke] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const handleRevoke = () => {
    if (!addressToRevoke || !/^0x[a-fA-F0-9]{40}$/i.test(addressToRevoke)) {
      return;
    }
    
    // Revoke max uint256 seconds to fully revoke membership
    writeContract({
      address: STP_V2_CONTRACT_ADDRESS,
      abi: STP_V2_REVOKE_ABI,
      functionName: 'revokeTime',
      args: [addressToRevoke as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
    setShowConfirmation(false);
  };
  
  const handleReset = () => {
    reset();
    setAddressToRevoke('');
  };
  
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Revoke Membership</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[var(--color-text)]">
              Wallet Address
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={addressToRevoke}
              onChange={(e) => setAddressToRevoke(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-secondary)]"
            />
          </div>
          
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!addressToRevoke || !/^0x[a-fA-F0-9]{40}$/i.test(addressToRevoke) || isPending || isConfirming}
            className="w-full px-4 py-2 bg-red-600 text-white font-medium disabled:opacity-50"
          >
            {isPending || isConfirming ? 'Processing...' : 'Revoke Membership'}
          </button>
          
          {isSuccess && (
            <div className="p-3 bg-green-900/20 border border-green-500/30">
              <p className="text-green-400 text-sm">
                Membership successfully revoked!
              </p>
              <button 
                onClick={handleReset}
                className="text-xs text-green-400 underline mt-1"
              >
                Revoke another
              </button>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30">
              <p className="text-red-400 text-sm">
                Error: {error.message}
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30">
          <p className="text-sm text-yellow-400">
            <strong>Warning:</strong> This is an on-chain action that permanently 
            revokes the user's membership. They will need to repurchase to regain access.
          </p>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2 text-[var(--color-text)]">
              Confirm Membership Revocation
            </h3>
            <p className="text-[var(--color-secondary)] mb-6">
              Are you sure you want to revoke membership for{' '}
              <span className="font-mono text-[var(--color-text)]">
                {addressToRevoke.slice(0, 6)}...{addressToRevoke.slice(-4)}
              </span>
              ? This is an on-chain action and cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 border border-[var(--color-border)] hover:bg-[var(--color-border)]/20"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium"
              >
                Yes, Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

