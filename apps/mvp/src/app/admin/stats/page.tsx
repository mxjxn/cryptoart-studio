'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
      <p className="text-sm text-[var(--color-secondary)]">{title}</p>
      <p className="text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      {subtitle && <p className="text-sm text-[var(--color-tertiary)]">{subtitle}</p>}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-[var(--color-secondary)]">{label}</span>
      <span className="font-medium text-[var(--color-text)]">{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

export default function StatsPage() {
  const { address } = useAccount();
  const [period, setPeriod] = useState<Period>('daily');
  const [revalidateStatus, setRevalidateStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    latestListingId?: string;
    recentListings?: Array<{ listingId: string; createdAt: string }>;
  }>({ status: 'idle' });
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats', period],
    queryFn: () => fetch(`/api/admin/stats?period=${period}&adminAddress=${address}`).then(r => r.json()),
    enabled: !!address,
  });
  
  const { data: ethPrice } = useQuery({
    queryKey: ['eth-price'],
    queryFn: () => fetch('/api/eth-price').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const revalidateHomepage = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/revalidate-homepage?adminAddress=${address}`, {
        method: 'POST',
      }).then(r => r.json()),
    onSuccess: (data) => {
      setRevalidateStatus({
        status: 'success',
        message: 'Homepage cache invalidated successfully',
        latestListingId: data.latestListingId,
        recentListings: data.recentListings,
      });
      // Clear status after 5 seconds
      setTimeout(() => {
        setRevalidateStatus({ status: 'idle' });
      }, 5000);
    },
    onError: (error: Error) => {
      setRevalidateStatus({
        status: 'error',
        message: error.message || 'Failed to revalidate homepage',
      });
      // Clear error after 5 seconds
      setTimeout(() => {
        setRevalidateStatus({ status: 'idle' });
      }, 5000);
    },
    onMutate: () => {
      setRevalidateStatus({ status: 'loading', message: 'Checking for new auctions...' });
    },
  });
  
  const formatUsd = (weiString: string | undefined) => {
    if (!weiString || !ethPrice?.usd) return '—';
    try {
      const eth = parseFloat(formatEther(BigInt(weiString)));
      return `$${(eth * ethPrice.usd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } catch {
      return '—';
    }
  };
  
  const formatEth = (weiString: string | undefined) => {
    if (!weiString) return '0 ETH';
    try {
      return `${formatEther(BigInt(weiString))} ETH`;
    } catch {
      return '0 ETH';
    }
  };
  
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Homepage Revalidation Section */}
      <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Homepage Cache</h3>
            <p className="text-sm text-[var(--color-secondary)]">
              Manually trigger homepage revalidation to check for new auctions
            </p>
          </div>
          <button
            onClick={() => revalidateHomepage.mutate()}
            disabled={revalidateHomepage.isPending || !address}
            className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-background)] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {revalidateHomepage.isPending ? 'Checking...' : 'Revalidate Homepage'}
          </button>
        </div>
        
        {/* Status Bar */}
        {revalidateStatus.status !== 'idle' && (
          <div className={`mt-3 p-3 rounded ${
            revalidateStatus.status === 'success' 
              ? 'bg-green-500/10 border border-green-500/20' 
              : revalidateStatus.status === 'error'
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-blue-500/10 border border-blue-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {revalidateStatus.status === 'loading' && (
                <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              )}
              {revalidateStatus.status === 'success' && (
                <span className="text-green-500">✓</span>
              )}
              {revalidateStatus.status === 'error' && (
                <span className="text-red-500">✗</span>
              )}
              <p className={`text-sm font-medium ${
                revalidateStatus.status === 'success' 
                  ? 'text-green-500' 
                  : revalidateStatus.status === 'error'
                  ? 'text-red-500'
                  : 'text-blue-500'
              }`}>
                {revalidateStatus.message}
              </p>
            </div>
            
            {revalidateStatus.status === 'success' && revalidateStatus.latestListingId && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-[var(--color-secondary)]">
                  Latest Listing ID: <span className="font-mono">{revalidateStatus.latestListingId}</span>
                </p>
                {revalidateStatus.recentListings && revalidateStatus.recentListings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--color-secondary)] mb-1">Recent Listings:</p>
                    <div className="space-y-1">
                      {revalidateStatus.recentListings.map((listing) => (
                        <div key={listing.listingId} className="text-xs font-mono text-[var(--color-tertiary)]">
                          #{listing.listingId} - {new Date(parseInt(listing.createdAt) * 1000).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              period === p 
                ? 'bg-[var(--color-primary)] text-[var(--color-background)]' 
                : 'bg-[var(--color-border)]/30 text-[var(--color-secondary)] hover:bg-[var(--color-border)]/50'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      
      {isLoading ? (
        <p className="text-[var(--color-secondary)]">Loading stats...</p>
      ) : stats?.error ? (
        <p className="text-[var(--color-secondary)]">{stats.error}</p>
      ) : (
        <>
          {/* Volume Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Volume"
              value={formatEth(stats?.totalVolumeWei)}
              subtitle={formatUsd(stats?.totalVolumeWei)}
            />
            <StatCard
              title="Platform Fees"
              value={formatEth(stats?.platformFeesWei)}
              subtitle={formatUsd(stats?.platformFeesWei)}
            />
            <StatCard
              title="Referral Fees"
              value={formatEth(stats?.referralFeesWei)}
              subtitle={formatUsd(stats?.referralFeesWei)}
            />
          </div>
          
          {/* Sales Breakdown */}
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
            <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Sales Breakdown</h3>
            <div className="space-y-1">
              <StatRow label="Total Sales" value={stats?.totalSales ?? 0} />
              <StatRow label="Auction Sales" value={stats?.auctionSales ?? 0} />
              <StatRow label="Fixed Price Sales" value={stats?.fixedPriceSales ?? 0} />
              <StatRow label="Accepted Offers" value={stats?.offerSales ?? 0} />
            </div>
          </div>
          
          {/* Activity Stats */}
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4">
            <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Activity</h3>
            <div className="space-y-1">
              <StatRow label="Active Auctions" value={stats?.activeAuctions ?? 0} />
              <StatRow label="Unique Bidders" value={stats?.uniqueBidders ?? 0} />
            </div>
          </div>
          
          {stats?.snapshotDate && (
            <p className="text-xs text-[var(--color-tertiary)]">
              Last updated: {new Date(stats.snapshotDate).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

