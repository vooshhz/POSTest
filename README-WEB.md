# POS System - Web Version

This is a fully web-based version of the POS system, converted from Electron to run entirely in the browser.

## Features

✅ **All Electron dependencies removed** - Pure web application
✅ **Browser-based storage** - Uses localStorage and IndexedDB
✅ **REST API communication** - All database operations via HTTP
✅ **CORS-enabled** - Proper cross-origin resource sharing
✅ **Responsive design** - Works on desktop and mobile browsers
✅ **No Node.js in frontend** - All browser-compatible APIs

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev -- --config vite.config.web.ts

# In another terminal, start the API server
node server-fly-fixed.js
```

### Production Build

```bash
# Windows
build-web.bat

# Linux/Mac
./build-web.sh

# Or manually
npx vite build --config vite.config.web.ts
```

### Deployment

The app is ready to deploy to any static hosting service:

1. **Static files**: Upload contents of `dist/` folder
2. **API Server**: Deploy `server-fly-fixed.js` separately
3. **Environment**: Set `VITE_API_URL` to your API endpoint

### Deployment Options

- **Vercel/Netlify**: Frontend static hosting
- **Fly.io**: Full-stack deployment (current setup)
- **AWS S3 + CloudFront**: Static hosting
- **Docker**: Containerized deployment

## Configuration

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8080/api  # Development
# VITE_API_URL=https://your-api.com/api  # Production
```

### API Endpoints

All API calls go through `/api/*` endpoints:

- `/api/login` - User authentication
- `/api/products` - Product management
- `/api/inventory` - Inventory operations
- `/api/transactions` - Transaction processing
- `/api/reports` - Reporting endpoints

## Architecture Changes from Electron

### Before (Electron)
- `ipcRenderer/ipcMain` → Direct database access
- Local SQLite files → File system storage
- Node.js modules → Native file operations
- Electron menus → Native desktop features

### After (Web)
- `fetch()` API → REST API calls
- Server-side SQLite → HTTP endpoints
- Browser APIs → Web storage (localStorage, IndexedDB)
- HTML/CSS menus → Web-based UI components

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Features Working Identically

✅ User authentication (PIN and password)
✅ Product scanning and lookup
✅ Inventory management
✅ Transaction processing
✅ Receipt generation
✅ Reporting and analytics
✅ User management
✅ Store configuration
✅ Till management

## Web-Specific Enhancements

- **Progressive Web App ready** - Can be installed as PWA
- **Offline support** - Service worker caching (can be added)
- **Cloud sync** - Data stored on server
- **Multi-device** - Access from any browser
- **No installation** - Runs directly in browser

## Security

- HTTPS required in production
- CORS configured for API access
- Authentication tokens in localStorage
- Secure session management
- API rate limiting recommended

## Testing

```bash
# Run the web build
npm run build -- --config vite.config.web.ts

# Serve locally
npx serve dist -p 3000

# API server must be running
node server-fly-fixed.js
```

## Troubleshooting

### API Connection Issues
- Ensure API server is running
- Check VITE_API_URL in .env
- Verify CORS settings on server

### Build Issues
- Clear node_modules and reinstall
- Remove dist folder before building
- Check for any remaining Electron imports

### Performance
- Enable gzip compression on server
- Use CDN for static assets
- Implement lazy loading for routes

## Migration Complete! 🎉

The application has been successfully converted from Electron to a pure web application with:

- **Zero Node.js dependencies in frontend**
- **Zero Electron-specific code**
- **100% browser-compatible**
- **Same functionality as desktop version**
- **Ready for cloud deployment**