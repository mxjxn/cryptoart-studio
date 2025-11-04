# Channel Cast Search API Documentation

## Overview

The Channel Cast Search API allows you to search for casts within specific Farcaster channels with advanced filtering capabilities including timeframes, text content, media types, and engagement metrics.

## Endpoint

```
GET /api/data/channel-casts
```

## Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `channelId` | string | The ID of the channel to search within |

## Optional Parameters

### Time-based Filtering
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `startDate` | string | Search for casts after this date | `2024-01-01` or `2024-01-01T00:00:00` |
| `endDate` | string | Search for casts before this date | `2024-12-31` or `2024-12-31T23:59:59` |

### Content Filtering
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `searchText` | string | Text to search for in cast content | `"crypto art"` |
| `authorFids` | string | Comma-separated FIDs to filter by specific authors | `"123,456,789"` |

### Media & Embed Filtering
| Parameter | Type | Description | Values |
|-----------|------|-------------|--------|
| `hasLinks` | string | Filter casts that contain links | `"true"` or `"false"` |
| `hasImages` | string | Filter casts that contain images | `"true"` or `"false"` |
| `hasEmbeds` | string | Filter casts that have any embeds | `"true"` or `"false"` |

### Engagement Filtering
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `minLikes` | integer | Minimum number of likes required | `10` |
| `minRecasts` | integer | Minimum number of recasts required | `5` |

### Pagination & Sorting
| Parameter | Type | Description | Default | Options |
|-----------|------|-------------|---------|---------|
| `limit` | integer | Number of results to return | `100` | `1-100` |
| `cursor` | string | Pagination cursor for next page | `null` | - |
| `sortType` | string | Sort order for results | `desc_chron` | `desc_chron`, `chron`, `algorithmic` |
| `mode` | string | Search mode | `literal` | `literal`, `semantic`, `hybrid` |

## Search Query Operators

Based on the [Neynar Search API](https://docs.neynar.com/reference/search-casts), the following operators are supported in `searchText`:

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | AND operator (default between terms) | `crypto + art` |
| `\|` | OR operator | `crypto \| art` |
| `*` | Prefix query | `crypto*` |
| `"..."` | Phrase search | `"crypto art"` |
| `( )` | Grouping for precedence | `crypto + (art \| nft)` |
| `~n` | Fuzzy matching | `crypto~2` |
| `-` | Negation | `crypto -scam` |

## Response Format

```json
{
  "channelId": "farcaster",
  "searchParams": {
    "timeframe": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "searchText": "crypto art",
    "hasLinks": "true",
    "hasImages": "false",
    "hasEmbeds": "true",
    "minLikes": 10,
    "minRecasts": 5,
    "authorFids": ["123", "456"]
  },
  "activityStats": {
    "totalCasts": 150,
    "originalCasts": 120,
    "replies": 30,
    "totalLikes": 2500,
    "totalRecasts": 800,
    "totalReplies": 200,
    "uniqueAuthors": 45,
    "castsWithLinks": 80,
    "castsWithImages": 25,
    "castsWithEmbeds": 100
  },
  "topActiveUsers": [
    {
      "fid": 123,
      "username": "artist1",
      "displayName": "Crypto Artist",
      "pfpUrl": "https://...",
      "followerCount": 5000,
      "powerBadge": true,
      "score": 95,
      "activity": {
        "totalCasts": 15,
        "originalCasts": 12,
        "replies": 3,
        "totalLikes": 500,
        "totalRecasts": 150,
        "totalReplies": 25
      }
    }
  ],
  "casts": [
    {
      "hash": "0x123...",
      "text": "Check out this amazing crypto art!",
      "timestamp": "2024-01-15T10:30:00Z",
      "author": {
        "fid": 123,
        "username": "artist1",
        "displayName": "Crypto Artist",
        "pfpUrl": "https://...",
        "followerCount": 5000,
        "powerBadge": true,
        "score": 95
      },
      "reactions": {
        "likesCount": 25,
        "recastsCount": 8
      },
      "replies": {
        "count": 3
      },
      "isReply": false,
      "channel": {
        "id": "farcaster",
        "name": "Farcaster",
        "url": "https://warpcast.com/~/farcaster"
      },
      "embeds": [
        {
          "url": "https://example.com/artwork.jpg",
          "type": "url",
          "isImage": true,
          "isLink": true
        }
      ],
      "hasLinks": true,
      "hasImages": true,
      "hasEmbeds": true
    }
  ],
  "pagination": {
    "next": "eyJjdXJzb3IiOiIxMjM0NTY3ODkwIn0=",
    "hasMore": true
  }
}
```

## Usage Examples

### Basic Channel Search
```bash
curl "https://your-domain.com/api/data/channel-casts?channelId=farcaster"
```

### Search with Text and Date Range
```bash
curl "https://your-domain.com/api/data/channel-casts?channelId=farcaster&searchText=crypto%20art&startDate=2024-01-01&endDate=2024-12-31"
```

### Filter for High-Engagement Casts with Images
```bash
curl "https://your-domain.com/api/data/channel-casts?channelId=farcaster&hasImages=true&minLikes=50&minRecasts=10"
```

### Search by Specific Authors
```bash
curl "https://your-domain.com/api/data/channel-casts?channelId=farcaster&authorFids=123,456,789"
```

### Complex Search Query
```bash
curl "https://your-domain.com/api/data/channel-casts?channelId=farcaster&searchText=\"crypto%20art\"%20OR%20nft&hasLinks=true&minLikes=20&sortType=algorithmic"
```

## Authentication

This endpoint requires CryptoArt membership validation. Include the following header:

```
x-farcaster-fid: YOUR_FID
```

## Rate Limits

- Standard Neynar API rate limits apply
- Maximum 100 results per request
- Use pagination for larger result sets

## Error Responses

### 400 Bad Request
```json
{
  "error": "channelId parameter is required"
}
```

### 403 Forbidden
```json
{
  "error": "Active /cryptoart Hypersub membership required"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to search channel casts. Please try again."
}
```

## Tips for Effective Searching

1. **Use specific channel IDs**: Channel IDs are more reliable than channel names
2. **Combine filters**: Use multiple filters to narrow down results effectively
3. **Use date ranges**: Limit searches to relevant time periods for better performance
4. **Leverage search operators**: Use quotes for exact phrases, OR for alternatives
5. **Monitor pagination**: Use cursors to efficiently paginate through large result sets
6. **Check engagement metrics**: Use `minLikes` and `minRecasts` to find popular content

## Integration Examples

### JavaScript/TypeScript
```typescript
async function searchChannelCasts(params: {
  channelId: string;
  searchText?: string;
  hasImages?: boolean;
  minLikes?: number;
}) {
  const searchParams = new URLSearchParams({
    channelId: params.channelId,
    ...(params.searchText && { searchText: params.searchText }),
    ...(params.hasImages && { hasImages: 'true' }),
    ...(params.minLikes && { minLikes: params.minLikes.toString() }),
  });

  const response = await fetch(`/api/data/channel-casts?${searchParams}`, {
    headers: {
      'x-farcaster-fid': 'YOUR_FID',
    },
  });

  return response.json();
}
```

### Python
```python
import requests

def search_channel_casts(channel_id, search_text=None, has_images=None, min_likes=None):
    params = {'channelId': channel_id}
    
    if search_text:
        params['searchText'] = search_text
    if has_images:
        params['hasImages'] = 'true'
    if min_likes:
        params['minLikes'] = min_likes
    
    headers = {'x-farcaster-fid': 'YOUR_FID'}
    
    response = requests.get('/api/data/channel-casts', params=params, headers=headers)
    return response.json()
```
