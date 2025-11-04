'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';
import { MobileLayout } from '~/components/ui/mobile/MobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Checkbox } from '~/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Download, Search, Users, Calendar, Star } from 'lucide-react';
import { AuthWrapper } from '~/components/AuthWrapper';

interface Subscriber {
  fid: number;
  username: string;
  displayName: string;
  walletAddress: string;
  pfpUrl: string;
  followerCount: number;
  followingCount: number;
  powerBadge: boolean;
  score: number;
  subscription: {
    contractAddress: string;
    subscribedAt: string;
    expiresAt: string;
    isActive: boolean;
    daysRemaining: number;
  };
}

interface SubscribersResponse {
  subscribers: Subscriber[];
  totalSubscribers: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  contractAddress: string;
}

const COLUMNS = [
  { id: 'fid', label: 'FID', export: true },
  { id: 'username', label: 'Username', export: true },
  { id: 'displayName', label: 'Display Name', export: true },
  { id: 'walletAddress', label: 'Wallet Address', export: true },
  { id: 'followerCount', label: 'Followers', export: true },
  { id: 'followingCount', label: 'Following', export: true },
  { id: 'powerBadge', label: 'Power Badge', export: true },
  { id: 'score', label: 'Score', export: true },
  { id: 'subscribedAt', label: 'Subscribed At', export: true },
  { id: 'expiresAt', label: 'Expires At', export: true },
  { id: 'daysRemaining', label: 'Days Remaining', export: true },
];

export default function SubscribersScreen() {
  const { context, isSDKLoaded } = useMiniApp();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('subscribedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(COLUMNS.map(col => col.id));
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Your Hypersub contract address
  const contractAddress = '0x3b3b7b66adf6950a7fc47155712e7e85381b507b';

  // Call ready() when SDK is loaded
  useEffect(() => {
    if (isSDKLoaded) {
      sdk.actions.ready();
    }
  }, [isSDKLoaded]);

  const fetchSubscribers = useCallback(async (offset = 0, reset = false) => {
    if (!context?.user?.fid) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        contractAddress,
        limit: '50',
        offset: offset.toString(),
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/subscribers?${params}`, {
        headers: {
          'x-farcaster-fid': context.user.fid.toString(),
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch subscribers');
      }

      const data: SubscribersResponse = await response.json();
      
      if (reset) {
        setSubscribers(data.subscribers);
        setCurrentPage(0);
      } else {
        setSubscribers(prev => [...prev, ...data.subscribers]);
      }
      
      setTotalSubscribers(data.totalSubscribers);
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscribers');
    } finally {
      setLoading(false);
    }
  }, [context?.user?.fid, contractAddress, sortBy, sortOrder, searchTerm]);

  useEffect(() => {
    if (context?.user?.fid) {
      fetchSubscribers(0, true);
    }
  }, [context?.user?.fid, searchTerm, sortBy, sortOrder, fetchSubscribers]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const _handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextOffset = (currentPage + 1) * 50;
      setCurrentPage(prev => prev + 1);
      fetchSubscribers(nextOffset, false);
    }
  };

  const exportToCSV = () => {
    const visibleColumns = COLUMNS.filter(col => selectedColumns.includes(col.id));
    const headers = visibleColumns.map(col => col.label);
    
    const csvContent = [
      headers.join(','),
      ...subscribers.map(sub => 
        visibleColumns.map(col => {
          let value = '';
          switch (col.id) {
            case 'subscribedAt':
              value = new Date(sub.subscription.subscribedAt).toLocaleDateString();
              break;
            case 'expiresAt':
              value = new Date(sub.subscription.expiresAt).toLocaleDateString();
              break;
            case 'daysRemaining':
              value = sub.subscription.daysRemaining.toString();
              break;
            case 'powerBadge':
              value = sub.powerBadge ? 'Yes' : 'No';
              break;
            default:
              value = sub[col.id as keyof Subscriber]?.toString() || '';
          }
          return `"${value}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };


  if (error) {
    return (
      <MobileLayout title="Subscribers">
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-red-600">
              <p className="text-sm">Error: {error}</p>
              <Button onClick={() => fetchSubscribers(0, true)} className="mt-3" size="sm">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </MobileLayout>
    );
  }

  return (
    <AuthWrapper>
      <MobileLayout 
        title="Subscribers"
      >
      <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Subscribers
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and export your Hypersub subscribers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColumnSelector(!showColumnSelector)}
          >
            Columns
          </Button>
          <Button onClick={exportToCSV} disabled={subscribers.length === 0} size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{totalSubscribers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="text-lg font-bold">
                  {subscribers.filter(s => s.powerBadge).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Days</p>
                <p className="text-lg font-bold">
                  {subscribers.length > 0 
                    ? Math.round(subscribers.reduce((sum, s) => sum + s.subscription.daysRemaining, 0) / subscribers.length)
                    : 0
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subscribers..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscribedAt">Subscribed Date</SelectItem>
                  <SelectItem value="expiresAt">Expires Date</SelectItem>
                  <SelectItem value="followerCount">Followers</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="username">Username</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Column Selector */}
      {showColumnSelector && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Columns to Display</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {COLUMNS.map(column => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.id}
                    checked={selectedColumns.includes(column.id)}
                    onCheckedChange={() => toggleColumn(column.id)}
                  />
                  <label htmlFor={column.id} className="text-sm">
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscribers Cards */}
      <div className="space-y-3">
        {subscribers.map((subscriber) => (
          <Card key={subscriber.fid} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={subscriber.pfpUrl}
                    alt={subscriber.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-sm">{subscriber.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{subscriber.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {subscriber.followerCount.toLocaleString()} followers
                      </Badge>
                      {subscriber.powerBadge && (
                        <Badge variant="default" className="bg-yellow-600 text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Power
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={subscriber.subscription.daysRemaining < 30 ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {subscriber.subscription.daysRemaining} days
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(subscriber.subscription.subscribedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {loading && (
        <div className="p-6 text-center">
          <p className="text-sm">Loading subscribers...</p>
        </div>
      )}
      
      {subscribers.length === 0 && !loading && (
        <div className="p-6 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No subscribers found</p>
        </div>
      )}
      
      {hasMore && (
        <div className="text-center">
          <Button onClick={loadMore} disabled={loading} size="sm">
            Load More Subscribers
          </Button>
        </div>
      )}
      </div>
    </MobileLayout>
    </AuthWrapper>
  );
}
