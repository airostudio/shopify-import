# Shopify Import Tool

A full-featured web application to import products from WooCommerce stores or CSV files into Shopify, with real-time progress tracking and detailed visual feedback.

## Features

### 🚀 Efficient Bulk Import
- **Shopify GraphQL Admin API (2026-01)**: Utilizes the latest Shopify bulk operations API
- **Concurrent Processing**: Up to 5 simultaneous bulk operations
- **Smart Batching**: Automatically splits large datasets into optimal batches
- **No Rate Limiting**: Bulk operations bypass standard API rate limits

### 📊 Real-Time Progress Tracking
- **WebSocket Integration**: Live updates during import process
- **Detailed Statistics**: Products count, batch progress, current operations
- **Visual Dashboard**: Material-UI components with progress bars and status cards
- **Error Reporting**: Comprehensive error messages with stack traces

### 🔄 Multiple Import Sources
1. **CSV Files**:
   - Shopify CSV format support
   - UTF-8 encoding with validation
   - Maximum 15MB file size
   - Automatic variant grouping

2. **WooCommerce Stores**:
   - REST API v3 integration
   - Automatic pagination (100 products per page)
   - Product variations support
   - Complete product data mapping

### 📦 Complete Product Data Support
- Products with variants
- Images and alt text
- Inventory quantities
- Pricing (regular and sale prices)
- SKUs and barcodes
- Categories and tags
- Product descriptions (HTML)
- Vendor and product type

## Architecture

### Backend (Node.js + Express)
```
server/
├── index.js                 # Main server with WebSocket
├── services/
│   ├── shopify.js          # Shopify GraphQL API client
│   ├── woocommerce.js      # WooCommerce REST API client
│   └── csv.js              # CSV parsing and validation
└── jobs/
    └── importJob.js        # Job queue management (Bull + Redis)
```

### Frontend (React + Material-UI)
```
client/src/
├── App.js                   # Main app component
└── components/
    ├── ShopifyConfig.js    # Shopify credentials configuration
    ├── CSVImport.js        # CSV file upload and import
    ├── WooCommerceImport.js # WooCommerce store connection
    └── ProgressDashboard.js # Real-time progress display
```

## Installation

### Prerequisites
- Node.js 18+ and npm
- Redis (for job queue - optional but recommended)
- Shopify store with Admin API access
- WooCommerce store (if importing from WooCommerce)

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd shopify-import
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd client
npm install
cd ..
```

4. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Shopify Configuration (can be set via UI)
SHOPIFY_SHOP_NAME=your-shop-name
SHOPIFY_ACCESS_TOKEN=your-admin-api-access-token
SHOPIFY_API_VERSION=2026-01

# Redis Configuration (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Upload Configuration
MAX_FILE_SIZE=15728640  # 15MB
UPLOAD_DIR=./uploads
```

5. **Start Redis (optional but recommended)**
```bash
redis-server
```

## Usage

### Development Mode

Start both backend and frontend in development mode:
```bash
npm run dev
```

Or start them separately:
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Production Mode

1. **Build the frontend**
```bash
npm run build
```

2. **Start the server**
```bash
NODE_ENV=production npm start
```

The application will be available at http://localhost:3001

## Getting Shopify API Credentials

1. Log in to your Shopify admin panel
2. Go to **Settings** → **Apps and sales channels**
3. Click **Develop apps**
4. Click **Create an app**
5. Name your app (e.g., "Product Import Tool")
6. Go to **Configuration** → **Admin API integration**
7. Configure scopes (required permissions):
   - `write_products`
   - `read_products`
   - `write_inventory`
   - `read_inventory`
8. Click **Install app**
9. Reveal and copy the **Admin API access token**
10. Use your shop name (e.g., if your store is `my-store.myshopify.com`, use `my-store`)

## Getting WooCommerce API Credentials

1. Log in to your WordPress admin panel
2. Go to **WooCommerce** → **Settings** → **Advanced** → **REST API**
3. Click **Add key**
4. Set the following:
   - **Description**: "Shopify Import Tool"
   - **User**: Select your admin user
   - **Permissions**: Read
5. Click **Generate API key**
6. Copy the **Consumer key** and **Consumer secret**
7. ⚠️ **Important**: Save these credentials securely - the secret won't be shown again!

## CSV File Format

The CSV file should follow Shopify's product CSV format. Required column:
- **Title**: Product name (required)

Common optional columns:
- Handle, Body (HTML), Vendor, Type, Tags
- Variant SKU, Variant Price, Variant Compare At Price
- Variant Inventory Qty, Variant Grams
- Image Src, Image Alt Text
- Option1 Name, Option1 Value (for variants)
- And more...

### Example CSV:
```csv
Handle,Title,Body (HTML),Vendor,Type,Tags,Variant Price,Variant SKU,Variant Inventory Qty,Image Src
tshirt-blue,Blue T-Shirt,<p>Comfortable cotton t-shirt</p>,MyBrand,Apparel,clothing,19.99,TSHIRT-BLU-001,100,https://example.com/tshirt.jpg
```

Download Shopify's official CSV template from the Shopify admin for reference.

## API Endpoints

### Backend API

#### Health Check
```http
GET /api/health
```

#### Test Shopify Connection
```http
POST /api/test/shopify
Content-Type: application/json

{
  "shopName": "your-store",
  "accessToken": "shpat_..."
}
```

#### Test WooCommerce Connection
```http
POST /api/test/woocommerce
Content-Type: application/json

{
  "url": "https://yourstore.com",
  "consumerKey": "ck_...",
  "consumerSecret": "cs_..."
}
```

#### Import from CSV
```http
POST /api/import/csv
Content-Type: multipart/form-data

file: <csv-file>
clientId: client-12345
shopifyConfig: {"shopName":"...","accessToken":"..."}
```

#### Import from WooCommerce
```http
POST /api/import/woocommerce
Content-Type: application/json

{
  "clientId": "client-12345",
  "wooConfig": {
    "url": "https://yourstore.com",
    "consumerKey": "ck_...",
    "consumerSecret": "cs_..."
  },
  "shopifyConfig": {
    "shopName": "your-store",
    "accessToken": "shpat_..."
  }
}
```

## How It Works

### CSV Import Flow
1. User uploads CSV file via drag-and-drop interface
2. File is validated for format and size
3. CSV is parsed and products are grouped by handle
4. Products are transformed to Shopify GraphQL format
5. Data is split into batches (max 100MB JSONL per batch)
6. JSONL files are uploaded to Shopify's staged targets
7. Bulk mutation operations are started (up to 5 concurrent)
8. Operations are polled every 5 seconds for completion
9. Progress updates are sent via WebSocket to frontend
10. Results are displayed in the progress dashboard

### WooCommerce Import Flow
1. User enters WooCommerce credentials
2. Connection is tested via REST API
3. Total product count is fetched
4. Products are fetched with pagination (100 per page)
5. Variable products have their variations loaded
6. Products are transformed to Shopify format
7. Same bulk import process as CSV (steps 5-10)

### Shopify Bulk Operations (2026-01 API)
- **Concurrent Operations**: Up to 5 bulk operations run simultaneously
- **JSONL Format**: Each line represents one product mutation
- **Staged Uploads**: Files are uploaded to Shopify's CDN
- **Polling**: Operations are polled for status (CREATED → RUNNING → COMPLETED)
- **No Rate Limits**: Bulk operations don't count against API rate limits
- **24-Hour Limit**: Operations must complete within 24 hours

## Technical Details

### WooCommerce API Pagination
- Maximum 100 products per page
- Uses `X-WP-Total` header for total count
- Uses `X-WP-TotalPages` header for page count
- Automatic retry logic with exponential backoff

### Shopify Data Mapping

**WooCommerce → Shopify:**
- `name` → `title`
- `description` → `descriptionHtml`
- `categories[0].name` → `productType`
- `tags` → `tags` (array)
- `price` → `variants[0].price`
- `regular_price` → `variants[0].compareAtPrice`
- `stock_quantity` → `variants[0].inventoryQuantities`
- `images` → `images` (with src and altText)

**CSV → Shopify:**
- Products with same `Handle` are grouped
- Multiple rows with same handle become variants
- Automatic handle generation from title if missing
- Weight converted from grams to kg

### WebSocket Protocol

Messages sent from server to client:
```json
{
  "type": "status|progress|complete|error",
  "jobId": "csv-1234567890",
  "status": "parsing|importing|completed|failed",
  "message": "Human-readable message",
  "progress": 0-100,
  "data": {
    "totalProducts": 1000,
    "currentBatch": 1,
    "totalBatches": 5,
    "...": "..."
  }
}
```

## Error Handling

- **CSV Validation**: File format, encoding, required columns
- **API Connection Tests**: Pre-flight checks before import
- **Retry Logic**: Exponential backoff for failed operations
- **Detailed Errors**: Full error messages and stack traces
- **WebSocket Fallback**: Graceful degradation if WebSocket fails

## Performance Optimizations

1. **Streaming CSV Parsing**: Low memory footprint for large files
2. **Batch Processing**: Optimal batch sizes (10,000 products per batch)
3. **Concurrent Operations**: 5 simultaneous bulk operations (2026-01 API)
4. **Efficient Pagination**: WooCommerce requests optimized with field filtering
5. **WebSocket Updates**: Throttled progress updates (every 100 products)

## Limitations

### Shopify Bulk Operations
- JSONL file size: Maximum 100MB per file
- Operation timeout: 24 hours
- Concurrent operations: 5 (in API version 2026-01)

### CSV Import
- File size: Maximum 15MB
- Encoding: UTF-8 required
- Format: Must follow Shopify CSV specification

### WooCommerce API
- Products per page: Maximum 100
- Rate limiting: Depends on hosting (add delays if needed)
- API version: WooCommerce REST API v3

## Troubleshooting

### WebSocket Connection Failed
- Check if port 3001 is accessible
- Ensure no firewall blocking WebSocket connections
- Try using `ws://` instead of `wss://` for local development

### Shopify API Errors
- Verify API access token has correct permissions
- Check API version is set to 2026-01
- Ensure shop name is correct (without .myshopify.com)

### WooCommerce Connection Issues
- Verify REST API is enabled in WooCommerce settings
- Check consumer key and secret are correct
- Ensure store URL includes https://
- Verify API user has admin permissions

### CSV Parse Errors
- Ensure file is UTF-8 encoded
- Check that "Title" column exists
- Verify no special characters in headers
- Maximum file size is 15MB

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review Shopify and WooCommerce API documentation

## Resources

- [Shopify Bulk Operations Documentation](https://shopify.dev/docs/api/usage/bulk-operations/imports)
- [WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [Shopify CSV Import Guide](https://help.shopify.com/en/manual/products/import-export/using-csv)

---

Built with ❤️ using Node.js, Express, React, and Material-UI
