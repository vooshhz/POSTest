# POS Lite - Claude Development Guide

## Overview

POS Lite is a minimal Point-of-Sale desktop application built with Electron, React, TypeScript, and SQLite. This is a template-based application that demonstrates basic inventory management functionality in a cross-platform desktop environment.

## Application Type
Desktop application (Electron-based) with a simple inventory management system for point-of-sale operations.

## Technology Stack

### Core Technologies
- **Electron 30.0.1** - Desktop app framework
- **React 18.2.0** - Frontend UI framework  
- **TypeScript 5.2.2** - Type-safe JavaScript
- **Vite 5.1.6** - Build tool and dev server
- **Better-SQLite3 12.2.0** - Embedded SQLite database

### Build & Development Tools
- **electron-builder 24.13.3** - Package and distribute app
- **vite-plugin-electron 0.28.6** - Vite integration for Electron
- **ESLint** - Code linting with TypeScript rules
- **pnpm** - Package manager (workspace configured)

## Project Structure

```
C:\POSTest\pos-lite\
├── src/                          # React renderer process
│   ├── App.tsx                   # Main React component with inventory form
│   ├── main.tsx                  # React app entry point
│   ├── global.d.ts              # Window API type definitions
│   └── assets/                   # Static assets
├── electron/                     # Electron main process
│   ├── main.ts                   # Main Electron process entry
│   ├── preload.ts               # Preload script for IPC bridge
│   ├── db.ts                    # SQLite database layer
│   └── electron-env.d.ts        # Electron type definitions
├── dist/                        # Built renderer (Vite output)
├── dist-electron/               # Built main process
├── public/                      # Static public assets
├── release/                     # Built distributables (electron-builder)
└── node_modules/                # Dependencies
```

## Key Architecture Patterns

### Electron IPC Communication
- **Preload Script**: `electron/preload.ts` exposes secure APIs via `contextBridge`
- **Main Process**: `electron/main.ts` handles IPC via `ipcMain.handle()`
- **Renderer Process**: React components call `window.api.*` methods
- **Type Safety**: Global type definitions ensure type-safe IPC calls

### Database Layer
- **SQLite Database**: Located at `app.getPath("userData")/pos.sqlite`
- **Tables**: 
  - `Product` (id, sku, name, barcode, price_cents, active)
  - `StockLedger` (id, product_id, qty_delta, reason, ts)
- **Journal Mode**: WAL (Write-Ahead Logging) for better concurrency
- **Business Logic**: Inventory tracking via ledger entries

### Build Configuration
- **Vite Config**: Custom Electron plugins with external native modules
- **TypeScript**: Strict mode with modern ES2020 target
- **Electron Builder**: Multi-platform distribution (Windows NSIS, macOS DMG, Linux AppImage)

## Development Commands

```bash
# Development (hot reload)
pnpm dev

# Build and package for distribution
pnpm build

# Lint TypeScript/React code
pnpm lint

# Preview built renderer
pnpm preview
```

## Important Development Notes

### Native Dependencies
- `better-sqlite3` requires native compilation
- Uses `@electron/rebuild` for native module rebuilding
- External modules configured in Vite config to prevent bundling issues

### Database Initialization
- Database and tables created automatically on first run
- Schema migrations should be handled manually in `db.ts`
- Database file persists in user data directory

### Type Safety
- Strict TypeScript configuration with all safety features enabled
- IPC methods are fully typed through global definitions
- React components use proper TypeScript patterns

### Cross-Platform Considerations
- App uses Electron's built-in path utilities
- Database location uses `app.getPath("userData")` for OS-appropriate storage
- Build configuration supports Windows, macOS, and Linux

## Current Functionality

The application currently provides:
1. **Add to Inventory**: Simple form to add products with SKU, name, and quantity
2. **Stock Tracking**: Automatic quantity calculation via ledger system
3. **Data Persistence**: SQLite database with proper foreign key relationships

## Extending the Application

When adding new features:
1. **Database Changes**: Update schema in `db.ts` initialization
2. **IPC Methods**: Add handlers in `registerInventoryIpc()` and expose in preload
3. **Type Definitions**: Update `src/global.d.ts` with new API methods
4. **UI Components**: Add React components in `src/` directory
5. **Build Process**: Update Vite external modules if adding native dependencies

## Security Considerations
- Context isolation is enabled by default
- No node integration in renderer process
- All main process APIs exposed through secure preload script
- Database queries use prepared statements to prevent SQL injection

## Testing & Quality
- ESLint configured with TypeScript and React rules
- No test framework currently configured
- Consider adding Jest or Vitest for unit tests
- Consider adding Playwright for E2E testing of Electron app