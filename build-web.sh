#!/bin/bash

echo "Building POS Web Application..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist/
rm -rf dist-electron/

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the web app
echo "Building web application..."
npm run build --config vite.config.web.ts

# Copy necessary files for deployment
echo "Preparing deployment files..."
cp package.web.json dist/package.json
cp server-fly-fixed.js dist/server.js

echo "Web build complete! Output in dist/ directory"
echo "To run locally: cd dist && npm install && npm start"