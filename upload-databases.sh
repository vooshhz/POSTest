#!/bin/bash

# Upload databases to Fly.io volume
echo "Uploading databases to Fly.io..."

# Check if databases exist locally
if [ ! -f "LiquorDatabase.db" ]; then
    echo "Error: LiquorDatabase.db not found!"
    exit 1
fi

if [ ! -f "LiquorInventory.db" ]; then
    echo "Error: LiquorInventory.db not found!"
    exit 1
fi

if [ ! -f "StoreInformation.db" ]; then
    echo "Error: StoreInformation.db not found!"
    exit 1
fi

echo "All database files found. Starting upload..."

# Upload each database file
echo "Uploading LiquorDatabase.db..."
flyctl ssh console -C "mkdir -p /data" -a your-pos-app
flyctl ssh sftp shell -a your-pos-app <<EOF
put LiquorDatabase.db /data/LiquorDatabase.db
put LiquorInventory.db /data/LiquorInventory.db
put StoreInformation.db /data/StoreInformation.db
EOF

echo "Database upload complete!"
echo "Restarting app to apply changes..."
flyctl apps restart your-pos-app

echo "Done! Your databases should now be available."