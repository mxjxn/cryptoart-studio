'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

type ErrorType = 'all' | 'transaction_failed' | 'api_error' | 'subgraph_error' | 'contract_error' | 'webhook_error';
type StatusFilter = 'all' | 'unresolved' | 'resolved';

interface ErrorLog {
  id: string;
  type: string;
  message: string;
  stack?: string;
  userAddress?: string;
  listingId?: string;
  transactionHash?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

function ErrorCard({ error, onResolve }: { error: ErrorLog; onResolve: () => void }) {
  const [expanded, setExpanded] = useState(false);
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'transaction_failed': return 'bg-red-500/20 text-red-400';
      case 'api_error': return 'bg-orange-500/20 text-orange-400';
      case 'subgraph_error': return 'bg-yellow-500/20 text-yellow-400';
      case 'contract_error': return 'bg-purple-500/20 text-purple-400';
      case 'webhook_error': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };
  
  return (
    <div className={`bg-[var(--color-background)] border border-[var(--color-border)] p-4 ${error.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium ${getTypeColor(error.type)}`}>
              {error.type.replace('_', ' ')}
            </span>
            <span className="text-xs text-[var(--color-tertiary)]">
              {new Date(error.createdAt).toLocaleString()}
            </span>
          </div>
          
          <p className="mt-2 font-medium text-[var(--color-text)] break-words">{error.message}</p>
          
          {error.endpoint && (
            <p className="text-sm text-[var(--color-secondary)] mt-1">
              Endpoint: {error.endpoint}
            </p>
          )}
          
          {error.transactionHash && (
            <p className="text-sm text-[var(--color-secondary)] mt-1 font-mono">
              Tx: {error.transactionHash.slice(0, 10)}...{error.transactionHash.slice(-6)}
            </p>
          )}
          
          {error.userAddress && (
            <p className="text-sm text-[var(--color-secondary)] mt-1 font-mono">
              User: {error.userAddress.slice(0, 6)}...{error.userAddress.slice(-4)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {!error.resolved && (
            <button
              onClick={onResolve}
              className="text-sm text-green-400 hover:underline"
            >
              Resolve
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-[var(--color-secondary)] hover:underline"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          {error.stack && (
            <div className="mb-2">
              <p className="text-xs font-medium text-[var(--color-secondary)] mb-1">Stack Trace:</p>
              <pre className="text-xs bg-[var(--color-border)]/20 p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {error.stack}
              </pre>
            </div>
          )}
          {error.metadata && (
            <div>
              <p className="text-xs font-medium text-[var(--color-secondary)] mb-1">Metadata:</p>
              <pre className="text-xs bg-[var(--color-border)]/20 p-2 overflow-x-auto">
                {JSON.stringify(error.metadata, null, 2)}
              </pre>
            </div>
          )}
          {error.resolved && error.resolvedAt && (
            <p className="text-xs text-[var(--color-secondary)] mt-2">
              Resolved at {new Date(error.resolvedAt).toLocaleString()}
              {error.resolvedBy && ` by ${error.resolvedBy.slice(0, 6)}...`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ErrorsPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [typeFilter, setTypeFilter] = useState<ErrorType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unresolved');
  
  const { data: errors, isLoading } = useQuery({
    queryKey: ['admin', 'errors', typeFilter, statusFilter],
    queryFn: () => 
      fetch(`/api/admin/errors?type=${typeFilter}&status=${statusFilter}&adminAddress=${address}`)
        .then(r => r.json()),
    enabled: !!address,
  });
  
  const resolveError = useMutation({
    mutationFn: (errorId: string) =>
      fetch(`/api/admin/errors/${errorId}/resolve?adminAddress=${address}`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => 
      queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] }),
  });
  
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ErrorType)}
          className="px-3 py-2 border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
        >
          <option value="all">All Types</option>
          <option value="transaction_failed">Transaction Failed</option>
          <option value="api_error">API Error</option>
          <option value="subgraph_error">Subgraph Error</option>
          <option value="contract_error">Contract Error</option>
          <option value="webhook_error">Webhook Error</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
        >
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>
      
      {/* Error Count */}
      <div className="text-sm text-[var(--color-secondary)]">
        {errors?.total ?? 0} error{errors?.total !== 1 ? 's' : ''} found
      </div>
      
      {/* Error List */}
      {isLoading ? (
        <p className="text-[var(--color-secondary)]">Loading errors...</p>
      ) : errors?.errors?.length === 0 ? (
        <p className="text-[var(--color-secondary)]">No errors found</p>
      ) : (
        <div className="space-y-4">
          {errors?.errors?.map((error: ErrorLog) => (
            <ErrorCard
              key={error.id}
              error={error}
              onResolve={() => resolveError.mutate(error.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

