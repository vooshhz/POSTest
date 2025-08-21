# Dockerfile - Simplified version

FROM node:18-slim

# Install dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy all files
COPY . .

# Build the web version
RUN npm run build:web

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server-complete.js"]