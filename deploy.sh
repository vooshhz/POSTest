#!/bin/bash

# POS System Web Deployment Script
# This script builds and deploys your app to Fly.io

echo "🚀 Starting deployment process..."

# Step 1: Build the web version
echo "📦 Building web version..."
pnpm run build:web

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors and try again."
    exit 1
fi

echo "✅ Build successful!"

# Step 2: Deploy to Fly.io
echo "☁️  Deploying to Fly.io..."
flyctl deploy

# Check if deployment was successful
if [ $? -ne 0 ]; then
    echo "❌ Deployment failed! Check the logs with: flyctl logs"
    exit 1
fi

echo "✅ Deployment successful!"
echo "🎉 Your app is now live at: https://your-pos-app.fly.dev/"
echo ""
echo "To view logs: flyctl logs"
echo "To SSH into server: flyctl ssh console"