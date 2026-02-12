#!/bin/bash

# Shopify Import Tool - Setup Script
# This script installs all dependencies for both backend and frontend

echo "🚀 Setting up Shopify Import Tool..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
cd ..
echo "✅ Frontend dependencies installed"
echo ""

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"
echo ""

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please edit .env and add your Shopify credentials"
else
    echo "ℹ️  .env file already exists"
fi
echo ""

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and configure your Shopify credentials (or configure via UI)"
echo "2. (Optional) Start Redis: redis-server"
echo "3. Run in development mode: npm run dev"
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "For production:"
echo "1. Build frontend: cd client && npm run build && cd .."
echo "2. Start server: NODE_ENV=production npm start"
echo ""
