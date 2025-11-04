'use client';

import { useState } from 'react';
import { useMiniApp } from '@neynar/react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/input';
import { 
  exportChannelCastsToCSV, 
  exportActivityStatsToCSV, 
  exportTopUsersToCSV, 
  downloadCSV,
  type ChannelSearchResponse 
} from '~/lib/channelExport';

interface ChannelSearchFilters {
  channelId: string;
  searchText: string;
  startDate: string;
  endDate: string;
  authorFids: string;
  hasLinks: string;
  hasImages: string;
  hasEmbeds: string;
  minLikes: string;
  minRecasts: string;
  limit: string;
  sortType: string;
}

export function ChannelSearch() {
  const { context } = useMiniApp();
  const [filters, setFilters] = useState<ChannelSearchFilters>({
    channelId: '',
    searchText: '',
    startDate: '',
    endDate: '',
    authorFids: '',
    hasLinks: '',
    hasImages: '',
    hasEmbeds: '',
    minLikes: '',
    minRecasts: '',
    limit: '100',
    sortType: 'desc_chron',
  });
  
  const [data, setData] = useState<ChannelSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchChannelCasts = async () => {
    if (!context?.user?.fid || !filters.channelId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('channelId', filters.channelId);
      
      if (filters.searchText) params.append('searchText', filters.searchText);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.authorFids) params.append('authorFids', filters.authorFids);
      if (filters.hasLinks) params.append('hasLinks', filters.hasLinks);
      if (filters.hasImages) params.append('hasImages', filters.hasImages);
      if (filters.hasEmbeds) params.append('hasEmbeds', filters.hasEmbeds);
      if (filters.minLikes) params.append('minLikes', filters.minLikes);
      if (filters.minRecasts) params.append('minRecasts', filters.minRecasts);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.sortType) params.append('sortType', filters.sortType);

      const response = await fetch(`/api/data/channel-casts?${params.toString()}`, {
        headers: {
          'x-farcaster-fid': context.user.fid.toString(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search channel casts');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (type: 'casts' | 'stats' | 'users') => {
    if (!data) return;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const channelName = data.channelId.replace(/[^a-zA-Z0-9]/g, '_');
    
    let content: string;
    let filename: string;
    
    switch (type) {
      case 'casts':
        content = exportChannelCastsToCSV(data);
        filename = `channel_casts_${channelName}_${timestamp}.csv`;
        break;
      case 'stats':
        content = exportActivityStatsToCSV(data);
        filename = `channel_stats_${channelName}_${timestamp}.csv`;
        break;
      case 'users':
        content = exportTopUsersToCSV(data);
        filename = `channel_users_${channelName}_${timestamp}.csv`;
        break;
    }
    
    downloadCSV(content, filename);
  };

  const updateFilter = (key: keyof ChannelSearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Channel Cast Search</h2>
        
        {/* Search Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Channel ID *</label>
            <Input
              value={filters.channelId}
              onChange={(e) => updateFilter('channelId', e.target.value)}
              placeholder="e.g., farcaster"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Search Text</label>
            <Input
              value={filters.searchText}
              onChange={(e) => updateFilter('searchText', e.target.value)}
              placeholder="Search in cast content"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Author FIDs</label>
            <Input
              value={filters.authorFids}
              onChange={(e) => updateFilter('authorFids', e.target.value)}
              placeholder="123,456,789"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Min Likes</label>
            <Input
              type="number"
              value={filters.minLikes}
              onChange={(e) => updateFilter('minLikes', e.target.value)}
              placeholder="10"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Min Recasts</label>
            <Input
              type="number"
              value={filters.minRecasts}
              onChange={(e) => updateFilter('minRecasts', e.target.value)}
              placeholder="5"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Limit</label>
            <select
              value={filters.limit}
              onChange={(e) => updateFilter('limit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Sort Type</label>
            <select
              value={filters.sortType}
              onChange={(e) => updateFilter('sortType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="desc_chron">Newest First</option>
              <option value="chron">Oldest First</option>
              <option value="algorithmic">Algorithmic</option>
            </select>
          </div>
        </div>

        {/* Media Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasLinks === 'true'}
              onChange={(e) => updateFilter('hasLinks', e.target.checked ? 'true' : '')}
              className="mr-2"
            />
            Has Links
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasImages === 'true'}
              onChange={(e) => updateFilter('hasImages', e.target.checked ? 'true' : '')}
              className="mr-2"
            />
            Has Images
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasEmbeds === 'true'}
              onChange={(e) => updateFilter('hasEmbeds', e.target.checked ? 'true' : '')}
              className="mr-2"
            />
            Has Embeds
          </label>
        </div>

        <Button 
          onClick={searchChannelCasts}
          disabled={loading || !filters.channelId}
          className="w-full"
        >
          {loading ? 'Searching...' : 'Search Channel Casts'}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Activity Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Activity Statistics</h3>
              <Button 
                onClick={() => handleDownload('stats')}
                variant="outline"
                size="sm"
              >
                Download Stats CSV
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-lg">{data.activityStats.totalCasts}</div>
                <div className="text-gray-600">Total Casts</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{data.activityStats.originalCasts}</div>
                <div className="text-gray-600">Original</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{data.activityStats.totalLikes}</div>
                <div className="text-gray-600">Total Likes</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{data.activityStats.uniqueAuthors}</div>
                <div className="text-gray-600">Unique Authors</div>
              </div>
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Top Active Users</h3>
              <Button 
                onClick={() => handleDownload('users')}
                variant="outline"
                size="sm"
              >
                Download Users CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">User</th>
                    <th className="text-right p-2">Casts</th>
                    <th className="text-right p-2">Likes</th>
                    <th className="text-right p-2">Recasts</th>
                    <th className="text-right p-2">Followers</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topActiveUsers.slice(0, 10).map((user) => (
                    <tr key={user.fid} className="border-b">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">@{user.username}</div>
                          <div className="text-gray-600 text-xs">{user.displayName}</div>
                        </div>
                      </td>
                      <td className="text-right p-2">{user.activity.totalCasts}</td>
                      <td className="text-right p-2">{user.activity.totalLikes}</td>
                      <td className="text-right p-2">{user.activity.totalRecasts}</td>
                      <td className="text-right p-2">{user.followerCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Casts Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Casts ({data.casts.length})</h3>
              <Button 
                onClick={() => handleDownload('casts')}
                variant="outline"
                size="sm"
              >
                Download Casts CSV
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Author</th>
                    <th className="text-left p-2">Text</th>
                    <th className="text-right p-2">Likes</th>
                    <th className="text-right p-2">Recasts</th>
                    <th className="text-right p-2">Replies</th>
                    <th className="text-left p-2">Media</th>
                    <th className="text-left p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.casts.slice(0, 50).map((cast) => (
                    <tr key={cast.hash} className="border-b">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">@{cast.author.username}</div>
                          <div className="text-gray-600 text-xs">FID: {cast.author.fid}</div>
                        </div>
                      </td>
                      <td className="p-2 max-w-xs">
                        <div className="truncate" title={cast.text}>
                          {cast.text}
                        </div>
                      </td>
                      <td className="text-right p-2">{cast.reactions.likesCount}</td>
                      <td className="text-right p-2">{cast.reactions.recastsCount}</td>
                      <td className="text-right p-2">{cast.replies.count}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {cast.hasImages && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">IMG</span>}
                          {cast.hasLinks && <span className="text-xs bg-green-100 text-green-800 px-1 rounded">LINK</span>}
                          {cast.hasEmbeds && <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">EMBED</span>}
                        </div>
                      </td>
                      <td className="p-2 text-xs text-gray-600">
                        {new Date(cast.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.casts.length > 50 && (
              <p className="text-sm text-gray-600 mt-2">
                Showing first 50 of {data.casts.length} casts. Download CSV for full data.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
