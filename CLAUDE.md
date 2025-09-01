# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with the POS Lite system codebase.

## Project Overview

This is an Electron-based Point of Sale (POS) system designed for liquor store inventory management. The system provides complete retail operations including product scanning, inventory tracking, transaction processing, reporting, and user management with both online and offline capabilities.

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Electron main process with Node.js
- **Database**: SQLite (better-sqlite3) with multiple databases
- **Build Tools**: Vite, TypeScript, Electron Builder
- **Package Manager**: pnpm
- **Styling**: CSS modules
- **State Management**: React hooks and context
- **IPC**: Electron's contextBridge for secure communication

## Commands

### Development
- `pnpm dev` - Start development server with Electron and Vite hot reload
- `pnpm build` - Build for production and create Electron distributables
- `pnpm lint` - Run ESLint to check TypeScript/React code quality
- `pnpm preview` - Preview production build

### Database Management
- `npx tsx scripts/import-csv-correct.ts` - Import product catalog from CSV
- `npx tsx scripts/check-db.ts` - Check database contents and integrity
- `npx tsx scripts/check-columns.ts` - Validate CSV column mappings

## Architecture

### Database Architecture

The system uses three separate SQLite databases for different purposes:

#### 1. LiquorDatabase.db (Product Catalog)
**Purpose**: Read-only product catalog imported from state liquor database CSV
**Location**: `./LiquorDatabase.db`
**Access**: Read-only connection

**Main Table: `products`**
```sql
- Item Number (TEXT)
- Category Name (TEXT)
- Item Description (TEXT)
- Vendor (TEXT)
- Vendor Name (TEXT)
- Bottle Volume (ml) (TEXT)
- Pack (INTEGER)
- Inner Pack (INTEGER)
- Age (TEXT)
- Proof (REAL)
- List Date (TEXT)
- UPC (TEXT) - Primary key for product identification
- SCC (TEXT)
- State Btl Cost (REAL)
- State Case Cost (REAL)
- State Btl Retail (REAL)
```

#### 2. LiquorInventory.db (Inventory & Transactions)
**Purpose**: Read-write database for inventory tracking and transaction history
**Location**: `./LiquorInventory.db`

**Tables:**
- `inventory` - Current stock levels, costs, prices
  - Links to products via UPC
  - Tracks quantity, cost, price per item
  - Timestamps for creation and updates

- `transactions` - Sales transaction records
  - Items (JSON), totals, payment info
  - User tracking and timestamps
  - Payment type (cash/debit/credit)

- `inventory_adjustments` - Audit trail of inventory changes
  - Tracks all quantity changes with reasons
  - Types: purchase, sale, adjustment, return, damage, theft
  - Before/after quantities for full audit trail

- `till_settings` - Cash drawer configuration
- `daily_till` - Daily cash drawer tracking and reconciliation
- `employee_time_clock` - Employee time tracking
- `payouts` - Cash drawer payouts

#### 3. StoreInformation.db (Store & User Management)
**Purpose**: Store configuration and user management
**Location**: `./StoreInformation.db`

**Tables:**
- `store_info` - Store details, tax rates, receipt settings
- `users` - User accounts with roles (admin/manager/cashier)
- `user_activity` - User action audit log

### Component Architecture

#### Main Process (`electron/`)
- `main.ts` - Electron app lifecycle, window management
- `db.ts` - Database operations and IPC handlers
- `preload.ts` - Secure context bridge API

#### Frontend Components (`src/`)

**Core Components:**
- `App.tsx` - Main application with tab navigation
- `Login.tsx` - User authentication screen

**POS Operations:**
- `CartScanner.tsx` - Main POS scanner and checkout interface
- `TillDashboard.tsx` - Cash drawer management
- `TillSettings.tsx` - Till configuration
- `TransactionCompleteModal.tsx` - Payment processing
- `ReceiptModal.tsx` - Receipt display/print
- `Payouts.tsx` - Cash drawer payout management

**Inventory Management:**
- `InventoryList.tsx` - Main inventory management interface
- `InventoryAdjustments.tsx` - Manual inventory adjustments
- `InventoryTransactions.tsx` - Inventory transaction history

**Employee Management:**
- `EmployeeTimeClock.tsx` - Employee clock in/out interface
- `TimeClockReports.tsx` - Employee time tracking reports

**Reporting (`src/reports/`):**
- `Sales.tsx` - Sales reports and analytics
- `WeeklySummary.tsx` - Weekly performance summary
- `InventoryAnalysis.tsx` - Stock analysis and trends
- `ProductPerformance.tsx` - Product sales metrics
- `FinancialReports.tsx` - Financial summaries
- `HourlyAnalysis.tsx` - Hourly sales patterns
- `ComplianceAudit.tsx` - Compliance and audit reports
- `VendorAnalysis.tsx` - Vendor performance analysis
- `Replenishment.tsx` - Stock replenishment recommendations

**Configuration:**
- `Settings.tsx` - Main settings interface
- `StoreSetup.tsx` - Store information configuration
- `ReceiptSettings.tsx` - Receipt customization
- `UserManagement.tsx` - User account management
- `DailySales.tsx` - Daily sales configuration

**Developer Tools:**
- `Developer.tsx` - Development utilities
- `MockDataByDateRange.tsx` - Test data generation
- `ClearData.tsx` - Database cleanup utilities

**Utilities (`src/components/`):**
- `DatePicker.tsx` - Date selection component
- `DateRangePicker.tsx` - Date range selection

## IPC Communication

### API Structure
All database operations go through the IPC bridge defined in `electron/preload.ts`:

```typescript
window.api = {
  // Product operations
  searchByUpc: (upc: string) => Promise<Product | null>
  searchProducts: (query: string) => Promise<Product[]>
  
  // Inventory operations
  checkInventory: (upc: string) => Promise<InventoryItem | null>
  getInventory: () => Promise<InventoryItem[]>
  addToInventory: (item: InventoryItem) => Promise<void>
  updateInventoryQuantity: (upc: string, change: number) => Promise<void>
  
  // Transaction operations
  createTransaction: (transaction: Transaction) => Promise<number>
  getTransactions: (dateRange?: DateRange) => Promise<Transaction[]>
  
  // User operations
  authenticateUser: (username: string, password: string) => Promise<User | null>
  createUser: (user: UserInput) => Promise<void>
  
  // Store operations
  getStoreInfo: () => Promise<StoreInfo>
  updateStoreInfo: (info: StoreInfo) => Promise<void>
  
  // Till operations
  getTillSettings: () => Promise<TillSettings>
  updateTillSettings: (settings: TillSettings) => Promise<void>
  
  // Employee operations
  clockIn: (userId: number) => Promise<void>
  clockOut: (userId: number) => Promise<void>
  getEmployeeTimeClocks: (dateRange?: DateRange) => Promise<TimeClockEntry[]>
  
  // Payout operations
  createPayout: (payout: Payout) => Promise<void>
  getPayouts: (dateRange?: DateRange) => Promise<Payout[]>
}
```

### IPC Handler Pattern
1. Frontend calls `window.api.methodName(params)`
2. Preload script invokes IPC channel
3. Main process handler in `db.ts` executes database operation
4. Result returned through Promise chain

## Data Flow

### Transaction Flow
1. User scans items in `CartScanner.tsx`
2. Product lookup via `searchByUpc` IPC call
3. Cart state managed locally in component
4. Payment processed through `TransactionCompleteModal`
5. Transaction recorded via `createTransaction`
6. Inventory adjusted via `updateInventoryQuantity`
7. Receipt displayed/printed via `ReceiptModal`

### Inventory Flow
1. Products imported from CSV to `LiquorDatabase.db`
2. Inventory items added/updated in `LiquorInventory.db`
3. All changes tracked in `inventory_adjustments` table
4. Real-time quantity updates during transactions
5. Reports generated from combined database queries

### Offline Mode
1. System detects network connectivity status
2. All operations continue working with local databases
3. Data synchronization queued when offline
4. Automatic sync when connection restored

## State Management

### User Context
- Current logged-in user stored in React context
- User permissions determine UI visibility
- Activity logging for all user actions

### Session Management
- Login state persisted during session
- Automatic logout on inactivity (configurable)
- Till reconciliation on user change

## Security Considerations

### Database Security
- Product database is read-only to prevent catalog corruption
- All database operations go through validated IPC handlers
- SQL injection prevention via parameterized queries

### User Security
- Role-based access control (admin/manager/cashier)
- PIN-based quick authentication for cashiers
- All actions logged with user attribution

### IPC Security
- Context bridge limits exposed APIs
- No direct database access from renderer
- Input validation in all IPC handlers

## Development Guidelines

### Code Organization
- Components grouped by feature area
- Shared components in `src/components/`
- Database logic isolated in `electron/db.ts`
- Type definitions co-located with implementations

### TypeScript Conventions
- Strict mode enabled
- Interfaces for all data structures
- Explicit return types for functions
- No `any` types without justification

### Database Operations
- Always use transactions for multi-step operations
- Check inventory existence before updates
- Log all inventory adjustments
- Validate UPC format before operations

### Error Handling
- Try-catch blocks in all IPC handlers
- User-friendly error messages in UI
- Detailed error logging to console
- Graceful fallbacks for missing data

### Testing Approach
- Test with both empty and populated databases
- Verify inventory calculations after transactions
- Test edge cases (negative inventory, etc.)
- Validate receipt calculations
- Test offline mode operations

## Common Tasks

### Adding a New Report
1. Create component in `src/reports/`
2. Add IPC handler for data retrieval in `db.ts`
3. Register route in Reports component
4. Add menu item to navigation

### Adding a New IPC Handler
1. Define method signature in `preload.ts`
2. Implement handler in `db.ts`
3. Add TypeScript types for parameters/return
4. Handle errors and edge cases

### Modifying Database Schema
1. Update schema in appropriate database initialization
2. Add migration logic for existing databases
3. Update TypeScript interfaces
4. Test with fresh and existing databases

## Troubleshooting

### Database Issues
- **Products not found**: Check if CSV import completed
- **Inventory mismatch**: Review inventory_adjustments table
- **Transaction failures**: Check payment type constraints
- **Sync issues**: Check offline queue status

### Build Issues
- **Native modules**: Run `pnpm rebuild` after electron version change
- **TypeScript errors**: Check for missing type definitions
- **Build failures**: Ensure all databases exist before building

### Performance Issues
- **Slow searches**: Add database indexes for frequently queried columns
- **Memory leaks**: Close database connections properly
- **UI lag**: Implement pagination for large datasets

## File Structure
```
pos-lite/
├── electron/              # Main process code
│   ├── main.ts           # App lifecycle
│   ├── db.ts             # Database operations
│   └── preload.ts        # IPC bridge
├── src/                  # React frontend
│   ├── components/       # Shared components
│   ├── reports/          # Report components
│   ├── *.tsx            # Feature components
│   └── *.css            # Component styles
├── scripts/              # Utility scripts
│   ├── import-csv-correct.ts
│   └── check-db.ts
├── LiquorDatabase.db     # Product catalog
├── LiquorInventory.db    # Inventory data
└── StoreInformation.db   # Store config
```

## Best Practices

### Performance
- Batch database operations when possible
- Use indexes for frequently queried columns
- Implement virtual scrolling for large lists
- Cache frequently accessed data
- Optimize offline sync operations

### User Experience
- Provide immediate feedback for all actions
- Show loading states during async operations
- Validate input before submission
- Maintain focus management for keyboard users
- Clear offline/online status indicators

### Code Quality
- Follow ESLint rules consistently
- Write self-documenting code
- Add comments for complex logic
- Keep components focused and small

### Security
- Never store sensitive data in plain text
- Validate all user inputs
- Use prepared statements for SQL
- Implement proper session management
- Secure offline data storage

## Important Notes

- **UPC is the primary key** linking products to inventory across databases
- **Product catalog is immutable** - never modify LiquorDatabase.db directly
- **All inventory changes must be tracked** in inventory_adjustments table
- **User actions require authentication** and are logged for audit purposes
- **Cash drawer reconciliation** required at shift changes
- **Tax calculations** use store-configured rates
- **Offline mode** maintains full functionality without network
- **Employee time tracking** integrated with payroll systems
- **Payout tracking** for cash drawer management