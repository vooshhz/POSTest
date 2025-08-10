# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with Electron and Vite hot reload
- `pnpm build` - Build for production and create Electron distributables
- `pnpm lint` - Run ESLint to check TypeScript/React code quality
- `pnpm preview` - Preview production build

### Database Management
- Import product catalog: `npx tsx scripts/import-csv-correct.ts`
- Check database contents: `npx tsx scripts/check-db.ts`
- Validate CSV columns: `npx tsx scripts/check-columns.ts`

## Architecture Overview

This is an Electron-based Point of Sale (POS) system for liquor inventory management using:
- **Frontend**: React 18 with TypeScript in `src/`
- **Backend**: Electron main process with SQLite databases
- **IPC Bridge**: Secure contextBridge API for database operations

### Dual Database Architecture
1. **LiquorDatabase.db** - Read-only product catalog imported from CSV
   - Contains full product details from state liquor database
   - Schema includes UPC, pricing, vendor info, bottle details
   
2. **LiquorInventory.db** - Read-write inventory tracking
   - Tracks actual store inventory with cost, price, quantity
   - Links to products via UPC

### Key Components

**Main Process** (`electron/main.ts`): Window management and app lifecycle

**Database Layer** (`electron/db.ts`): All SQLite operations with IPC handlers for:
- `searchByUpc` - Product catalog lookup
- `checkInventory` - Inventory status check  
- `addToInventory` - Add/update inventory items
- `getInventory` - Retrieve all inventory
- `importCsv` - Import product catalog from CSV

**Frontend Components**:
- `src/CartScanner.tsx` - POS scanner tab for checkout/cart management
- `src/InventoryList.tsx` - Inventory management tab for stock control
- `src/App.tsx` - Main app with tab navigation

### IPC Communication Pattern
Frontend components call window.api methods (defined in `electron/preload.ts`) which invoke IPC handlers in the main process (`electron/db.ts`) for all database operations.

## Development Guidelines

### Database Operations
- Product catalog is read-only - never modify LiquorDatabase.db directly
- All inventory modifications go through the IPC API
- Use transactions for bulk operations
- UPC is the primary key linking products to inventory

### TypeScript Types
- Product and InventoryItem interfaces are defined in `electron/db.ts`
- Import and use these types consistently across components

### Error Handling
- Database operations return typed responses with success/error states
- Display user-friendly error messages in the UI
- Log detailed errors to console for debugging

### Testing Database Changes
Always test with both databases present:
1. Ensure LiquorDatabase.db has product data (run import if empty)
2. Test inventory operations don't affect product catalog
3. Verify UPC lookups work across both databases