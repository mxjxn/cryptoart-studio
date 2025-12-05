'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

export default function HiddenUsersPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [newAddress, setNewAddress] = useState('');
  
  const { data: hiddenUsers, isLoading } = useQuery({
    queryKey: ['admin', 'hidden-users'],
    queryFn: () => fetch(`/api/admin/users/hidden?adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  const hideUser = useMutation({
    mutationFn: (userAddress: string) =>
      fetch('/api/admin/users/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden-users'] });
      setNewAddress('');
    },
  });
  
  const unhideUser = useMutation({
    mutationFn: (userAddress: string) =>
      fetch('/api/admin/users/unhide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress, adminAddress: address }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hidden-users'] });
    },
  });

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };
  
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Add user to hide */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Hide User</h2>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (newAddress && /^0x[a-fA-F0-9]{40}$/i.test(newAddress)) {
              hideUser.mutate(newAddress);
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Wallet address (0x...)"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="flex-1 px-3 py-2 border border-[var(--color-border)] bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-secondary)]"
          />
          <button
            type="submit"
            disabled={!newAddress || !/^0x[a-fA-F0-9]{40}$/i.test(newAddress) || hideUser.isPending}
            className="px-4 py-2 bg-red-600 text-white font-medium disabled:opacity-50"
          >
            Hide
          </button>
        </form>
        <p className="text-sm text-[var(--color-secondary)] mt-2">
          Hidden users' listings won't appear in algorithms or discovery feeds.
        </p>
      </div>
      
      {/* Hidden users list */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
          Hidden Users ({hiddenUsers?.users?.length ?? 0})
        </h2>
        
        {isLoading ? (
          <p className="text-[var(--color-secondary)]">Loading...</p>
        ) : hiddenUsers?.users?.length === 0 ? (
          <p className="text-[var(--color-secondary)]">No hidden users</p>
        ) : (
          <div className="space-y-2">
            {hiddenUsers?.users?.map((user: { userAddress: string; hiddenAt: string }) => (
              <div 
                key={user.userAddress}
                className="flex items-center justify-between p-3 bg-[var(--color-background)] border border-[var(--color-border)]"
              >
                <div>
                  <p className="font-mono text-sm text-[var(--color-text)]">{formatAddress(user.userAddress)}</p>
                  <p className="text-xs text-[var(--color-secondary)]">
                    Hidden {new Date(user.hiddenAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => unhideUser.mutate(user.userAddress)}
                  disabled={unhideUser.isPending}
                  className="text-sm text-blue-500 hover:underline disabled:opacity-50"
                >
                  Unhide
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

