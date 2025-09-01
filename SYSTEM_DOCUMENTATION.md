# POS Lite System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Initial Setup](#initial-setup)
3. [User Management](#user-management)
4. [Point of Sale Operations](#point-of-sale-operations)
5. [Inventory Management](#inventory-management)
6. [Cash Drawer Management](#cash-drawer-management)
7. [Employee Time Clock](#employee-time-clock)
8. [Reporting System](#reporting-system)
9. [Settings & Configuration](#settings--configuration)
10. [Developer Tools](#developer-tools)
11. [Offline Mode](#offline-mode)
12. [Database Architecture](#database-architecture)
13. [Security Features](#security-features)
14. [Troubleshooting](#troubleshooting)

---

## System Overview

POS Lite is a comprehensive Point of Sale system designed specifically for liquor stores. Built with Electron, React, and SQLite, it provides complete retail operations management with both online and offline capabilities.

### Key Features
- **Barcode Scanning**: Fast product lookup and checkout
- **Inventory Tracking**: Real-time stock management with adjustment tracking
- **Multi-User Support**: Role-based access control (Admin, Manager, Cashier)
- **Cash Drawer Management**: Till tracking and reconciliation
- **Employee Time Clock**: Built-in time tracking for payroll
- **Comprehensive Reporting**: Sales, inventory, and financial analytics
- **Offline Mode**: Full functionality without internet connection
- **Receipt Printing**: Customizable receipt templates
- **State Compliance**: Michigan liquor database integration

### Technology Stack
- **Frontend**: React 18 with TypeScript
- **Backend**: Electron with Node.js
- **Database**: SQLite (3 separate databases)
- **Build System**: Vite + Electron Builder
- **Package Manager**: pnpm

---

## Initial Setup

### First Time Launch

When launching the application for the first time, you'll go through a two-step setup process:

#### Step 1: Store Information
1. **Store Name**: Your business name (appears on receipts)
2. **Address**: Complete physical address
3. **Phone Number**: Contact number for receipts
4. **Tax Rate**: Default sales tax percentage (e.g., 6.0%)
5. **Receipt Settings**:
   - Header text (appears at top of receipts)
   - Footer text (appears at bottom of receipts)

#### Step 2: Administrator Account
1. **Username**: Admin login username
2. **Full Name**: Administrator's full name
3. **Password**: Secure password (minimum 4 characters)
4. **Confirm Password**: Re-enter password

### Developer Access
- **DEV Button**: Orange button available on all screens
- Provides emergency access to developer tools
- Bypasses authentication when needed
- Located in top-left corner (login/setup) or with navigation tabs (main app)

---

## User Management

### User Roles

#### 1. Administrator
- Full system access
- Can create/edit/delete users
- Access to all reports
- Modify store settings
- Perform factory reset
- Access time tracking for all employees

#### 2. Manager
- Access to most features
- Can view reports
- Manage inventory
- Process payouts
- View employee time records
- Cannot modify system settings or users

#### 3. Cashier
- Limited to POS operations
- Can process sales
- Clock in/out for shifts
- Cannot access reports or settings
- PIN-based quick login (4-digit)

### User Authentication

#### Login Process
1. **Username Entry**: Enter username and press Continue
2. **Authentication**:
   - **Admin/Manager**: Password authentication
   - **Cashier**: 4-digit PIN pad

#### Creating Users (Admin Only)
1. Navigate to Settings → User Management
2. Click "Add New User"
3. Enter user details:
   - Username (unique)
   - Full Name
   - Role selection
   - Password (Admin/Manager) OR PIN (Cashier)
4. Set active status

### Session Management
- Automatic session tracking
- User activity logging
- Logout with shift management for cashiers
- Option to punch out when logging out (cashiers)

---

## Point of Sale Operations

### Cart Scanner (Main POS Interface)

#### Scanning Products
1. **Barcode Scanner**: Automatic focus on barcode field
2. **Manual Entry**: Type UPC and press Enter
3. **Product Lookup**: Searches Michigan liquor database
4. **Automatic Addition**: Products added to cart instantly

#### Cart Management
- **Quantity Adjustment**: +/- buttons for each item
- **Remove Items**: X button to delete from cart
- **Running Total**: Live calculation with tax
- **Clear Cart**: Remove all items at once

#### Checkout Process
1. **Complete Sale Button**: Opens payment modal
2. **Payment Types**:
   - **Cash**: Enter amount given, calculates change
   - **Debit Card**: Records exact amount
   - **Credit Card**: Records exact amount
3. **Transaction Recording**:
   - Updates inventory quantities
   - Records in transaction history
   - Logs inventory adjustments
   - Updates daily till (if enabled)
4. **Receipt Options**:
   - Print receipt
   - View receipt
   - Email receipt (future feature)

#### Quick Actions
- **F2**: Focus barcode scanner
- **F3**: Quick clear cart
- **F4**: Complete sale
- **ESC**: Cancel current operation

---

## Inventory Management

### Inventory List View

#### Features
- **Search Bar**: Filter by UPC, description, or vendor
- **Barcode Scanner**: Quick product lookup
- **Stock Levels**: Visual indicators (green/yellow/red)
- **Sorting Options**: By description, quantity, vendor, etc.
- **Pagination**: 50 items per page

### Adding Products to Inventory

#### From Product Catalog
1. Scan or search for product
2. If not in inventory, "Add to Inventory" appears
3. Set initial quantity
4. Enter cost and retail price
5. Product added with timestamp

#### Manual Addition
1. Click "Add New Item"
2. Enter product details:
   - UPC (required)
   - Description
   - Volume
   - Quantity
   - Cost
   - Retail Price
3. Save to inventory

### Inventory Adjustments

#### Adjustment Types
- **Purchase**: Receiving new stock
- **Sale**: Automatic from POS transactions
- **Adjustment**: Manual count corrections
- **Return**: Customer returns
- **Damage**: Damaged product write-offs
- **Theft**: Loss prevention tracking

#### Making Adjustments
1. Select product from inventory
2. Click "Adjust"
3. Choose adjustment type
4. Enter quantity change (+/-)
5. Add reason/notes
6. Adjustment logged with timestamp and user

### Stock Tracking
- **Real-time Updates**: Instant quantity changes
- **Audit Trail**: Complete adjustment history
- **Low Stock Alerts**: Visual warnings
- **Negative Prevention**: Blocks sales if insufficient stock

---

## Cash Drawer Management

### Till Settings

#### Configuration
1. Navigate to Settings → Till Settings
2. Enable/Disable till tracking
3. Set starting denominations:
   - $1, $5, $10, $20, $50, $100 bills
   - Rolls of coins (optional)
4. Save settings

### Daily Till Operations

#### Opening Till
1. System prompts at first login
2. Count and enter starting cash
3. Verify against expected amount
4. Record any discrepancies

#### During Operations
- Automatic tracking of cash transactions
- Running total of expected cash
- Change calculation and tracking

#### Closing Till
1. End of shift/day prompt
2. Count actual cash
3. System calculates variance
4. Generate reconciliation report
5. Option to print/save report

### Payouts

#### Creating Payouts
1. Click "Payout" button
2. Enter details:
   - Amount
   - Reason/Description
   - Authorized by
3. Cash removed from till
4. Payout logged with timestamp

#### Payout Tracking
- Complete payout history
- Daily payout reports
- Running till balance updates
- Audit trail with user attribution

---

## Employee Time Clock

### Clock In/Out Process

#### For Cashiers
1. **Auto-prompt**: Time clock appears after login
2. **Clock In**: Single button press
3. **During Shift**: Time tracking active
4. **Clock Out Options**:
   - Manual clock out
   - Auto-prompt on logout
   - End of day reminder

#### For Managers/Admins
- Optional time tracking
- Can clock in/out from Settings
- View all employee time records

### Time Tracking Features

#### Shift Management
- **Active Shift Display**: Current duration
- **Break Tracking**: Optional break logging
- **Overtime Calculation**: Based on 40-hour week
- **Shift History**: Complete time records

#### Reports
- **Daily Time Report**: Who worked when
- **Weekly Summary**: Hours per employee
- **Payroll Export**: CSV format for processing
- **Individual Timecards**: Per-employee records

---

## Reporting System

### Sales Reports

#### Daily Sales
- Transaction count and total
- Payment type breakdown
- Hourly sales pattern
- Top selling products
- Cashier performance

#### Weekly/Monthly Summary
- Sales trends
- Comparison to previous periods
- Average transaction value
- Peak hours/days analysis

### Inventory Reports

#### Stock Analysis
- Current inventory value
- Stock turnover rates
- Low stock items
- Overstock identification
- Dead stock analysis

#### Product Performance
- Best sellers
- Slow movers
- Profit margins
- Vendor performance
- Category analysis

### Financial Reports

#### Revenue Analysis
- Gross sales
- Tax collected
- Discounts given
- Net revenue
- Profit margins

#### Cash Management
- Till reconciliation history
- Payout summaries
- Cash vs. card sales
- Daily deposits

### Compliance Reports

#### Audit Trail
- All inventory adjustments
- User activity log
- Transaction modifications
- System access log

#### State Compliance
- Age-restricted sales tracking
- License verification logs
- Required state reports

---

## Settings & Configuration

### Store Settings

#### Information Management
- Update store details
- Modify tax rate
- Change receipt text
- Business hours setting

### Receipt Settings

#### Customization Options
- Header/Footer text
- Logo upload (future)
- Field selection
- Format options

### User Management
- Add/Edit/Delete users
- Password resets
- Role modifications
- Access control

### System Settings

#### Database Management
- Backup configuration
- Auto-backup schedule
- Restore from backup

#### Display Settings
- Theme selection (future)
- Font size
- Language (future)

---

## Developer Tools

### Overview Dashboard
- System health status
- Database statistics
- Error logs
- Performance metrics

### Data Management

#### Clear Data Options
1. **Clear Inventory**: Removes all products
2. **Clear Sales**: Deletes transaction history
3. **Clear All Data**: Wipes inventory and sales
4. **Factory Reset**: Complete system reset

#### Mock Data Generation
- Generate test transactions
- Create sample inventory
- Populate time clock data
- Useful for testing/demos

### Database Tools
- Direct SQL query execution
- Table inspection
- Data export/import
- Schema modifications

### Import Tools

#### CSV Import
- Michigan liquor database import
- Bulk inventory updates
- Transaction import
- User import

---

## Offline Mode

### Capabilities
- **Full POS Operations**: All sales functions work offline
- **Inventory Management**: Track stock changes locally
- **Report Generation**: Access historical data
- **User Management**: Local authentication

### Limitations
- No cloud backup while offline
- No remote access
- No real-time multi-store sync
- Product catalog updates delayed

### Synchronization
- Automatic sync when online
- Conflict resolution for simultaneous changes
- Queue management for pending operations
- Status indicators for sync state

---

## Database Architecture

### Three-Database System

#### 1. LiquorDatabase.db (Product Catalog)
- **Purpose**: Read-only product information
- **Source**: Michigan state liquor database
- **Updates**: Via CSV import
- **Contents**: 
  - UPC codes
  - Product descriptions
  - Vendor information
  - State pricing

#### 2. LiquorInventory.db (Operations)
- **Purpose**: Store inventory and transactions
- **Contents**:
  - Current inventory levels
  - Transaction history
  - Inventory adjustments
  - Till settings and daily records
  - Payout records

#### 3. StoreInformation.db (Configuration)
- **Purpose**: Store and user management
- **Contents**:
  - Store information
  - User accounts
  - User activity logs
  - Time clock records
  - System settings

### Data Relationships
- Products linked via UPC across databases
- User actions tracked with user_id
- Transactions reference inventory items
- Adjustments maintain audit trail

---

## Security Features

### Access Control
- Role-based permissions
- Secure password hashing
- PIN authentication for cashiers
- Session management

### Audit Trail
- Complete user activity logging
- Transaction history immutable
- Inventory adjustment tracking
- Login/logout records

### Data Protection
- Local database encryption (future)
- Automatic backups
- Transaction integrity checks
- Prevent data tampering

### Compliance
- Age verification prompts
- State reporting compliance
- Tax calculation accuracy
- Legal receipt requirements

---

## Troubleshooting

### Common Issues

#### "Product Not Found"
- **Cause**: UPC not in state database
- **Solution**: 
  1. Verify UPC is correct
  2. Check for updated product catalog
  3. Add manually if private label

#### "Foreign Key Constraint Failed"
- **Cause**: Database relationship error
- **Solution**:
  1. Check user exists
  2. Verify data integrity
  3. Contact support if persists

#### "Cannot Create User"
- **Cause**: Username already exists
- **Solution**:
  1. Choose different username
  2. Check for duplicate entries
  3. Perform factory reset if corrupted

#### Till Doesn't Balance
- **Cause**: Unrecorded transactions or errors
- **Solution**:
  1. Review transaction history
  2. Check for payouts
  3. Verify starting amount
  4. Look for system errors

### System Maintenance

#### Regular Tasks
1. **Daily**: Till reconciliation
2. **Weekly**: Database backup
3. **Monthly**: Clear old logs
4. **Quarterly**: Update product catalog

#### Performance Optimization
- Clear transaction history (keep backups)
- Rebuild database indexes
- Remove unused products
- Archive old reports

### Emergency Procedures

#### System Won't Start
1. Check database files exist
2. Verify permissions
3. Run in developer mode
4. Restore from backup

#### Data Corruption
1. Stop using system immediately
2. Make backup of current state
3. Restore from last good backup
4. Manually recreate recent transactions

#### Factory Reset Process
1. Access Developer tools
2. Navigate to Clear Data
3. Select Factory Reset
4. Confirm three times
5. System returns to initial setup

---

## Workflows

### Daily Opening Procedure
1. First employee logs in
2. Open till (if enabled)
3. Count starting cash
4. Verify inventory counts (spot check)
5. Begin operations

### Processing a Sale
1. Scan/enter products
2. Verify customer age (if prompted)
3. Complete sale
4. Select payment type
5. Process payment
6. Provide receipt

### End of Day Procedure
1. Close till
2. Count cash
3. Record variance
4. Process deposits
5. Run daily reports
6. Backup database
7. Log out all users

### Inventory Receiving
1. Receive shipment
2. Scan products
3. Enter quantities received
4. Verify costs
5. Update retail prices if needed
6. File adjustment as "Purchase"

---

## Best Practices

### Security
- Change default admin password immediately
- Use strong passwords for admin/manager
- Regular password updates
- Don't share user accounts
- Log out when not in use

### Data Management
- Daily backups
- Keep 30 days of backups
- Test restore process monthly
- Archive old data annually

### Operations
- Reconcile till daily
- Verify high-value transactions
- Spot-check inventory weekly
- Review reports for anomalies
- Train staff on all procedures

### Compliance
- Keep software updated
- Maintain accurate records
- File required reports on time
- Verify age for restricted sales
- Document all adjustments

---

## Support Information

### Getting Help
- Developer Tools → Help section
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Check this documentation
- Review error logs

### System Requirements
- **OS**: Windows 10/11, macOS 10.14+, Linux
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB for application, 5GB for data
- **Display**: 1280x720 minimum
- **Network**: Required for updates only

### Version Information
- Current Version: 1.0.2
- Database Version: 3
- Electron Version: 32.1.0
- Last Updated: September 2024

---

## Appendices

### Keyboard Shortcuts
- **F2**: Focus barcode scanner
- **F3**: Clear cart
- **F4**: Complete sale
- **F5**: Refresh
- **Ctrl+S**: Save current form
- **Esc**: Cancel operation

### Error Codes
- **ERR_001**: Database connection failed
- **ERR_002**: Invalid barcode
- **ERR_003**: Insufficient inventory
- **ERR_004**: User authentication failed
- **ERR_005**: Transaction failed

### Glossary
- **UPC**: Universal Product Code (barcode)
- **SKU**: Stock Keeping Unit
- **POS**: Point of Sale
- **Till**: Cash drawer
- **Variance**: Difference between expected and actual

---

## Future Enhancements (Roadmap)

### Planned Features
- Multi-store support
- Cloud synchronization
- Customer loyalty program
- Gift card processing
- Advanced analytics dashboard
- Mobile companion app
- Supplier integration
- Automated ordering

### Under Consideration
- Kitchen display system
- Table management
- Reservation system
- Online ordering integration
- Delivery management
- Customer database
- Marketing tools
- Advanced reporting

---

*This documentation represents the complete functionality of the POS Lite system as of September 2024. For updates and additional information, consult the CLAUDE.md file or contact the development team.*