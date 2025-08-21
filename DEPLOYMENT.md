# Web Deployment Guide for POS System

## Overview
This POS system has been adapted to run both as a desktop Electron app and as a web application on Fly.io.

## Key Changes Made for Web Deployment

### 1. Files Added for Web Deployment
- `Dockerfile` - Containerizes the app for Fly.io
- `fly.toml` - Fly.io configuration
- `.dockerignore` - Prevents unnecessary files from being deployed
- `server-fly-fixed.js` - Express server that serves the app and handles API requests
- `src/api/webApiLayer.ts` - Web API layer that replaces Electron IPC calls
- `src/api/webApiLayerComplete.ts` - Complete web API implementation

### 2. Modified Files
- `src/api/apiLayer.ts` - Now detects environment and uses either Electron or Web API
- `package.json` - Added `build:web` script
- `src/DailySales.tsx` - Fixed optional chaining for undefined data
- `src/App.tsx` - Fixed logout dialog props
- Multiple report files - Changed from `window.api` to imported `api`

### 3. Database Setup
All three SQLite databases are stored in Fly.io's persistent `/data` volume:
- `/data/LiquorDatabase.db` - Product catalog
- `/data/LiquorInventory.db` - Inventory and transactions
- `/data/StoreInformation.db` - Store configuration and users

## How to Deploy Updates

### Quick Deploy (After Making Changes)

1. **Build the web version:**
```bash
pnpm run build:web
```

2. **Deploy to Fly.io:**
```bash
flyctl deploy
```

That's it! Your changes are now live at https://your-pos-app.fly.dev/

### Full Deploy Process (If Starting Fresh)

1. **Ensure all web files are present:**
   - Dockerfile
   - fly.toml
   - server-fly-fixed.js
   - .dockerignore

2. **Build and deploy:**
```bash
pnpm run build:web
flyctl deploy
```

3. **Upload databases (only needed once or when updating database):**
```bash
flyctl ssh console
cd /data
# Then upload your .db files via SFTP or copy them
```

## Important Files to Preserve

**NEVER DELETE OR MODIFY these files without understanding their purpose:**

1. **Server file:** `server-fly-fixed.js`
   - This is your web server that handles all API requests
   - Contains all endpoints for database operations

2. **Web API Layer:** `src/api/webApiLayer.ts`
   - Translates frontend API calls to HTTP requests
   - Must match server endpoints

3. **API Layer:** `src/api/apiLayer.ts`
   - Intelligently switches between Electron and Web APIs
   - Contains the isElectron() detection

4. **Deployment files:**
   - `Dockerfile`
   - `fly.toml`
   - `.dockerignore`

## Making Changes to Your App

### For Frontend Changes (React Components):
1. Make your changes to any `.tsx` files
2. Run `pnpm run build:web`
3. Run `flyctl deploy`

### For Database Schema Changes:
1. Update your local database
2. Upload the new database to Fly.io:
```bash
flyctl ssh console
cd /data
# Upload new .db file
```

### For API Changes:
1. If adding new API functionality:
   - Add endpoint to `server-fly-fixed.js`
   - Add corresponding method to `src/api/webApiLayer.ts`
   - Ensure `src/api/apiLayer.ts` exports the new method
2. Build and deploy as usual

## Environment Detection

The app automatically detects if it's running in Electron or Web:
```typescript
// In src/api/apiLayer.ts
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.api && 
         typeof window.api.searchByUpc === 'function';
};
```

## Troubleshooting

### If inventory doesn't load:
- Check if databases exist: `flyctl ssh console` then `ls /data`
- Verify server is running: `flyctl logs`

### If API calls fail:
- Check browser console for errors
- Verify endpoints match between server and webApiLayer.ts
- Check CORS settings in server

### If build fails:
- Run `pnpm install` first
- Check for TypeScript errors: `pnpm run lint`
- For web-only build: `pnpm run build:web`

## Quick Reference Commands

```bash
# Local development
pnpm dev              # Run Electron app locally

# Web deployment
pnpm run build:web    # Build for web
flyctl deploy         # Deploy to Fly.io
flyctl logs          # View server logs
flyctl ssh console   # SSH into server

# Database management
flyctl ssh console
cd /data
ls -la               # List database files
```

## Maintaining Both Versions

To keep both desktop and web versions working:

1. **Always use the api import:**
```typescript
import { api } from './api/apiLayer';
// NOT: window.api
```

2. **Test both versions after major changes:**
   - Desktop: `pnpm dev`
   - Web: `pnpm run build:web && flyctl deploy`

3. **Keep server endpoints in sync:**
   - When adding features, update both Electron IPC and web endpoints

## Future Updates Workflow

1. Pull latest changes from git (if using version control)
2. Make your updates to the code
3. Test locally: `pnpm dev`
4. Build for web: `pnpm run build:web`
5. Deploy: `flyctl deploy`
6. Verify at https://your-pos-app.fly.dev/

## Notes

- The web version uses localStorage for temporary data storage
- Authentication is session-based for web (vs local for desktop)
- File paths in server use `/data/` (not `./`)
- All database operations go through the Express server on web

Last updated: August 2024
Web deployment configured for: https://your-pos-app.fly.dev/