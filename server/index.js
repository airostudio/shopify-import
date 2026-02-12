require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ShopifyService = require('./services/shopify');
const WooCommerceService = require('./services/woocommerce');
const CSVService = require('./services/csv');
const ImportJob = require('./jobs/importJob');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 15 * 1024 * 1024 // 15MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// WebSocket connection management
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = req.url.split('?clientId=')[1] || Date.now().toString();
  clients.set(clientId, ws);

  console.log(`WebSocket client connected: ${clientId}`);

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

// Helper function to broadcast progress to specific client
function broadcastProgress(clientId, progressData) {
  const client = clients.get(clientId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(progressData));
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import from CSV
app.post('/api/import/csv', upload.single('file'), async (req, res) => {
  try {
    const { clientId, shopifyConfig } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!shopifyConfig) {
      return res.status(400).json({ error: 'Shopify configuration is required' });
    }

    const config = JSON.parse(shopifyConfig);

    // Start import job
    const jobId = `csv-${Date.now()}`;

    res.json({
      success: true,
      jobId,
      message: 'CSV import started'
    });

    // Process asynchronously
    processCSVImport(jobId, req.file.path, config, clientId);

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from WooCommerce
app.post('/api/import/woocommerce', async (req, res) => {
  try {
    const { clientId, wooConfig, shopifyConfig } = req.body;

    if (!wooConfig || !shopifyConfig) {
      return res.status(400).json({ error: 'Both WooCommerce and Shopify configurations are required' });
    }

    // Start import job
    const jobId = `woo-${Date.now()}`;

    res.json({
      success: true,
      jobId,
      message: 'WooCommerce import started'
    });

    // Process asynchronously
    processWooCommerceImport(jobId, wooConfig, shopifyConfig, clientId);

  } catch (error) {
    console.error('WooCommerce import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get import status
app.get('/api/import/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    // This would query job status from Redis/database
    res.json({
      jobId,
      status: 'processing',
      message: 'Job status endpoint (implement with Redis)'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Shopify connection
app.post('/api/test/shopify', async (req, res) => {
  try {
    const { shopName, accessToken } = req.body;
    const shopifyService = new ShopifyService(shopName, accessToken);
    const isValid = await shopifyService.testConnection();

    res.json({
      success: isValid,
      message: isValid ? 'Connection successful' : 'Connection failed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test WooCommerce connection
app.post('/api/test/woocommerce', async (req, res) => {
  try {
    const { url, consumerKey, consumerSecret } = req.body;
    const wooService = new WooCommerceService(url, consumerKey, consumerSecret);
    const isValid = await wooService.testConnection();

    res.json({
      success: isValid,
      message: isValid ? 'Connection successful' : 'Connection failed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process CSV Import
async function processCSVImport(jobId, filePath, shopifyConfig, clientId) {
  try {
    broadcastProgress(clientId, {
      type: 'status',
      jobId,
      status: 'parsing',
      message: 'Parsing CSV file...',
      progress: 0
    });

    const csvService = new CSVService();
    const products = await csvService.parseCSV(filePath, (progress) => {
      broadcastProgress(clientId, {
        type: 'progress',
        jobId,
        status: 'parsing',
        message: `Parsing CSV: ${progress}%`,
        progress
      });
    });

    broadcastProgress(clientId, {
      type: 'status',
      jobId,
      status: 'parsed',
      message: `Parsed ${products.length} products`,
      progress: 20,
      data: { totalProducts: products.length }
    });

    // Import to Shopify
    const shopifyService = new ShopifyService(
      shopifyConfig.shopName,
      shopifyConfig.accessToken
    );

    await shopifyService.bulkImport(products, (progress, details) => {
      broadcastProgress(clientId, {
        type: 'progress',
        jobId,
        status: 'importing',
        message: details.message,
        progress: 20 + (progress * 0.8),
        data: details
      });
    });

    // Clean up file
    fs.unlinkSync(filePath);

    broadcastProgress(clientId, {
      type: 'complete',
      jobId,
      status: 'completed',
      message: 'Import completed successfully',
      progress: 100
    });

  } catch (error) {
    console.error('CSV import processing error:', error);
    broadcastProgress(clientId, {
      type: 'error',
      jobId,
      status: 'failed',
      message: error.message,
      error: error.stack
    });
  }
}

// Process WooCommerce Import
async function processWooCommerceImport(jobId, wooConfig, shopifyConfig, clientId) {
  try {
    broadcastProgress(clientId, {
      type: 'status',
      jobId,
      status: 'connecting',
      message: 'Connecting to WooCommerce...',
      progress: 0
    });

    const wooService = new WooCommerceService(
      wooConfig.url,
      wooConfig.consumerKey,
      wooConfig.consumerSecret
    );

    // Fetch all products with pagination
    const products = await wooService.fetchAllProducts((progress, details) => {
      broadcastProgress(clientId, {
        type: 'progress',
        jobId,
        status: 'fetching',
        message: details.message,
        progress: progress * 0.3,
        data: details
      });
    });

    broadcastProgress(clientId, {
      type: 'status',
      jobId,
      status: 'fetched',
      message: `Fetched ${products.length} products from WooCommerce`,
      progress: 30,
      data: { totalProducts: products.length }
    });

    // Import to Shopify
    const shopifyService = new ShopifyService(
      shopifyConfig.shopName,
      shopifyConfig.accessToken
    );

    await shopifyService.bulkImport(products, (progress, details) => {
      broadcastProgress(clientId, {
        type: 'progress',
        jobId,
        status: 'importing',
        message: details.message,
        progress: 30 + (progress * 0.7),
        data: details
      });
    });

    broadcastProgress(clientId, {
      type: 'complete',
      jobId,
      status: 'completed',
      message: 'Import completed successfully',
      progress: 100
    });

  } catch (error) {
    console.error('WooCommerce import processing error:', error);
    broadcastProgress(clientId, {
      type: 'error',
      jobId,
      status: 'failed',
      message: error.message,
      error: error.stack
    });
  }
}

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

module.exports = { app, server, wss };
