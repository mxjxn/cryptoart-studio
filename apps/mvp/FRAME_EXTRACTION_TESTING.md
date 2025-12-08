# Frame Extraction Testing Guide

This guide explains how to test the GIF and video frame extraction functionality for OG images.

## Overview

The frame extraction feature:
- Extracts the first frame from animated GIFs
- Extracts the first frame from videos (MP4, WebM)
- Falls back to `animation_url` if `image` field is missing
- Caches extracted frames separately from original media

## Prerequisites

1. **Sharp library installed**: `npm install sharp`
2. **For video extraction**: `ffmpeg` should be installed (optional - will fall back gracefully if not available)
3. **Server logs accessible**: You'll need to see console output

## Testing Methods

### Method 1: Test with Existing Listings

#### Step 1: Find Listings with GIFs/Videos

You can check listings in your database or via the API:

```bash
# Check a specific listing's metadata
curl http://localhost:3000/api/auctions/27 | jq '.metadata'

# Or use the debug endpoint
curl http://localhost:3000/api/debug/listing/27 | jq '.metadata'
```

Look for:
- `image` field ending in `.gif` or video extensions (`.mp4`, `.webm`, etc.)
- `animation_url` field with GIF/video URLs

#### Step 2: Test Homepage OG Image

```bash
# Request the homepage OG image
curl -I http://localhost:3000/opengraph-image

# Or view in browser
open http://localhost:3000/opengraph-image
```

**What to check:**
- The image should load (even if some listings have GIFs/videos)
- Check server logs for frame extraction messages

#### Step 3: Test Listing-Specific OG Image

```bash
# Replace 27 with a listing ID that has a GIF/video
curl -I http://localhost:3000/listing/27/opengraph-image

# Or view in browser
open http://localhost:3000/listing/27/opengraph-image
```

**What to check:**
- The OG image should show the artwork (first frame if it's a GIF/video)
- Check server logs for extraction messages

### Method 2: Test with Known GIF/Video URLs

#### Step 1: Create a Test Listing or Use Debug Endpoint

You can test directly with known URLs:

```bash
# Test with a public GIF URL
curl "http://localhost:3000/opengraph-image" \
  -H "X-Test-Image-Url: https://example.com/test.gif"
```

Or modify the code temporarily to inject a test URL.

#### Step 2: Check Logs

Look for these log messages:

**Successful GIF extraction:**
```
[OG Image] Extracting first frame from GIF for listing 27
[OG Image] Successfully extracted frame for listing 27, size: 12345 bytes
[OG Image] Successfully cached extracted frame for listing 27
```

**Successful video extraction:**
```
[OG Image] Extracting first frame from video for listing 27
[OG Image] Successfully extracted frame for listing 27, size: 23456 bytes
```

**Fallback to animation_url:**
```
[OG Image] Using animation_url as image source for listing 27
```

**Cache hit:**
```
[OG Image] Cache hit for listing 27
```

**Extraction failure (graceful fallback):**
```
[OG Image] Extracting first frame from video for listing 27
[OG Image] Failed to extract frame for listing 27: [error message]
```

### Method 3: Database Query to Find Test Cases

```sql
-- Find listings with GIFs in image field
SELECT listing_id, image 
FROM listings 
WHERE image LIKE '%.gif%' 
LIMIT 5;

-- Find listings with videos in animation_url
SELECT l.listing_id, m.animation_url
FROM listings l
JOIN metadata m ON l.token_address = m.contract_address AND l.token_id = m.token_id
WHERE m.animation_url LIKE '%.mp4%' 
   OR m.animation_url LIKE '%.webm%'
LIMIT 5;
```

## What to Verify

### ✅ Success Indicators

1. **OG Images Load**: Both homepage and listing OG images should render without errors
2. **Log Messages**: You should see extraction messages in logs for GIFs/videos
3. **Cache Working**: Second request should show "Cache hit" messages
4. **Static Frames**: Extracted frames should be static PNG images (not animated)

### ❌ Failure Indicators

1. **Missing Images**: OG image shows "No Image" placeholder
2. **Error Messages**: Logs show extraction failures
3. **Invalid Format Errors**: Magic bytes validation failing

## Debugging Tips

### Check Frame Extractor Directly

You can test the frame extractor utility directly:

```typescript
// In a test file or Node REPL
import { extractFirstFrame } from './lib/server/frame-extractor';
import fetch from 'node-fetch';

const testGifUrl = 'https://example.com/test.gif';
const response = await fetch(testGifUrl);
const buffer = Buffer.from(await response.arrayBuffer());
const result = await extractFirstFrame(testGifUrl, buffer, 'image/gif');

console.log('Success:', result.success);
console.log('Content Type:', result.contentType);
console.log('Buffer Size:', result.buffer.length);
```

### Verify Sharp Installation

```bash
# Check if sharp is installed
npm list sharp

# If not installed
npm install sharp
```

### Check FFmpeg (for video extraction)

```bash
# Check if ffmpeg is available
ffmpeg -version

# If not installed (macOS)
brew install ffmpeg

# If not installed (Linux)
sudo apt-get install ffmpeg
```

### Common Issues

1. **"sharp library is required"**
   - Solution: `npm install sharp`

2. **Video extraction fails**
   - Check if ffmpeg is installed
   - Videos will fall back gracefully if extraction fails
   - Check logs for specific error messages

3. **Cache not working**
   - Check database connection
   - Verify `image_cache` table exists
   - Check cache expiration times

4. **Magic bytes validation failing**
   - Check logs for hex bytes output
   - Verify the file is actually a GIF/video
   - Some IPFS gateways may return HTML error pages instead of media

## Testing Checklist

- [ ] Homepage OG image loads with listings that have GIFs
- [ ] Homepage OG image loads with listings that have videos
- [ ] Listing-specific OG image loads for GIF listings
- [ ] Listing-specific OG image loads for video listings
- [ ] `animation_url` is used as fallback when `image` is missing
- [ ] Extracted frames are cached (check second request shows cache hit)
- [ ] Logs show extraction messages for GIFs/videos
- [ ] No errors in server logs
- [ ] OG images display correctly in social media previews

## Manual Testing Steps

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Find a listing with a GIF or video:**
   - Check your database or use the API
   - Note the listing ID

3. **Test homepage OG image:**
   - Visit: `http://localhost:3000/opengraph-image`
   - Check if it renders (should show 5 recent listings)
   - Check server logs for any extraction messages

4. **Test listing-specific OG image:**
   - Visit: `http://localhost:3000/listing/[LISTING_ID]/opengraph-image`
   - Replace `[LISTING_ID]` with a listing that has a GIF/video
   - Check if the artwork appears (should be first frame if animated)
   - Check server logs

5. **Test cache:**
   - Request the same OG image twice
   - Second request should show "Cache hit" in logs
   - Response should be faster

6. **Test with different media types:**
   - Try listings with:
     - Animated GIFs
     - MP4 videos
     - WebM videos
     - Static images (should work as before)

## Expected Log Output

### Successful GIF Extraction:
```
[OG Image] Processing image for listing 27: https://ipfs.io/ipfs/QmHash...
[OG Image] Full image URL for listing 27: https://ipfs.io/ipfs/QmHash...
[OG Image] Cache miss for listing 27, fetching...
[OG Image] Will try 3 URL(s) for listing 27: https://cloudflare-ipfs.com/ipfs/QmHash...
[OG Image] Extracting first frame from GIF for listing 27
[OG Image] Successfully extracted frame for listing 27, size: 45678 bytes
[OG Image] Successfully cached extracted frame for listing 27
[OG Image] Successfully fetched image for listing 27 from https://cloudflare-ipfs.com/ipfs/QmHash...
```

### Successful Video Extraction:
```
[OG Image] Processing image for listing 27: https://ipfs.io/ipfs/QmVideoHash...
[OG Image] Extracting first frame from video for listing 27
[OG Image] Successfully extracted frame for listing 27, size: 67890 bytes
[OG Image] Successfully cached extracted frame for listing 27
```

### Cache Hit:
```
[OG Image] Processing image for listing 27: https://ipfs.io/ipfs/QmHash...
[OG Image] Cache hit for listing 27
```

## Next Steps

After testing:
1. Monitor production logs for extraction success rates
2. Check cache hit rates for extracted frames
3. Verify OG images display correctly in social media (Twitter, Discord, etc.)
4. Consider adding metrics/monitoring for extraction failures


