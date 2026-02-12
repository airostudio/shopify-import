# Quick Start Guide

## Installation

### Option 1: Automated Setup (Recommended)
```bash
./setup.sh
```

### Option 2: Manual Setup
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..

# Create environment file
cp .env.example .env

# Create uploads directory
mkdir -p uploads
```

## Running the Application

### Development Mode
```bash
# Start both backend and frontend
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client
```

Access at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Production Mode
```bash
# Build frontend
cd client && npm run build && cd ..

# Start server
NODE_ENV=production npm start
```

Access at: http://localhost:3001

## Configuration

### Shopify Credentials
You can configure Shopify in two ways:

**Option 1: Via UI (Recommended)**
- Leave .env defaults
- Enter credentials in the web interface
- Test connection before importing

**Option 2: Via Environment Variables**
Edit `.env`:
```env
SHOPIFY_SHOP_NAME=your-store
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
```

### Getting Shopify API Credentials
1. Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Configure Admin API scopes:
   - `write_products`
   - `read_products`
   - `write_inventory`
   - `read_inventory`
4. Install app and copy the Admin API access token

### Getting WooCommerce API Credentials
1. WordPress Admin → WooCommerce → Settings
2. Advanced → REST API → Add key
3. Set permissions to "Read"
4. Copy Consumer Key and Consumer Secret

## Troubleshooting

### "react-scripts: command not found"
Run the setup script or install dependencies manually:
```bash
./setup.sh
# OR
npm install && cd client && npm install
```

### Port Already in Use
Change the port in `.env`:
```env
PORT=3002
```

And update proxy in `client/package.json`:
```json
"proxy": "http://localhost:3002"
```

### Redis Connection Error
Redis is optional. If not using Redis, the app will still work but without job queue features. To disable Redis warnings, comment out Redis-related code in `server/jobs/importJob.js`.

## Features

- ✅ CSV file import (drag & drop)
- ✅ WooCommerce store import
- ✅ Real-time progress tracking
- ✅ Up to 5 concurrent bulk operations
- ✅ Automatic batching (10k products per batch)
- ✅ Complete product data (variants, images, inventory)
- ✅ Connection testing for both APIs
- ✅ Detailed error messages

## Support

See the main [README.md](README.md) for comprehensive documentation.
