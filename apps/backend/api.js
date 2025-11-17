/**
 * Express API server for auction house listings
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Note: This requires @repo/db to be available
// For now, we'll use a simpler approach without the db package
// In production, you'd import: const { getDatabase, auctionListings, auctionBids } = require('@repo/db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// TODO: Import database client when db package is properly configured
// For now, using placeholder - you'll need to configure database connection
let db = null;

// Placeholder endpoints - these will work once db is connected
app.get('/api/listings', async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    // TODO: Implement database query
    // For now, return empty array
    res.json({ listings: [], total: 0, message: 'Database not configured yet' });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

app.get('/api/listings/active', async (req, res) => {
  try {
    // TODO: Implement database query for active INDIVIDUAL_AUCTION listings
    res.json({ listings: [], total: 0, message: 'Database not configured yet' });
  } catch (error) {
    console.error('Error fetching active listings:', error);
    res.status(500).json({ error: 'Failed to fetch active listings' });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    // TODO: Implement database query
    res.status(404).json({ error: 'Listing not found' });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

app.get('/api/listings/:id/bids', async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    
    // TODO: Implement database query
    res.json({ bids: [], total: 0, message: 'Database not configured yet' });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET /api/listings`);
  console.log(`   GET /api/listings/active`);
  console.log(`   GET /api/listings/:id`);
  console.log(`   GET /api/listings/:id/bids`);
  console.log(`   GET /health`);
});

