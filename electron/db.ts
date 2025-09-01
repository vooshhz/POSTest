// REPLACE THE ENTIRE electron/db.ts file with this:

import { IpcMain } from "electron";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import Papa from "papaparse";
import { getDatabasePaths } from "./database-paths";

// Get database paths based on environment (dev vs production)
const { productsDbPath, inventoryDbPath, storeInfoDbPath } = getDatabasePaths();

let productsDb: Database.Database | null = null;
let inventoryDb: Database.Database | null = null;
let storeInfoDb: Database.Database | null = null;

// Track if handlers are already registered
let handlersRegistered = false;

// Get products database (read-only for product catalog)
function getProductsDb() {
  if (!productsDb) {
    productsDb = new Database(productsDbPath, { readonly: true });
  }
  return productsDb;
}

// Get store info database
function getStoreInfoDb() {
  if (!storeInfoDb) {
    console.log("Creating new StoreInfo database connection at:", storeInfoDbPath);
    storeInfoDb = new Database(storeInfoDbPath);
    // Create store_info table if it doesn't exist
    storeInfoDb.exec(`
      CREATE TABLE IF NOT EXISTS store_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT NOT NULL,
        address_line1 TEXT NOT NULL,
        address_line2 TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        tax_rate REAL NOT NULL DEFAULT 6.0,
        receipt_header TEXT,
        receipt_footer TEXT DEFAULT 'Thank you for your business!',
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        pin TEXT,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier')),
        full_name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS user_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS time_clock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        punch_in DATETIME NOT NULL,
        punch_out DATETIME,
        shift_date DATE NOT NULL,
        duration_minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity(timestamp);
      CREATE INDEX IF NOT EXISTS idx_time_clock_user ON time_clock(user_id);
      CREATE INDEX IF NOT EXISTS idx_time_clock_date ON time_clock(shift_date);
    `);
    
    // Check if PIN column exists, add if it doesn't
    const userTableInfo = storeInfoDb.pragma("table_info(users)");
    const hasPinColumn = (userTableInfo as any[]).some((col: any) => col.name === 'pin');
    
    if (!hasPinColumn) {
      storeInfoDb.exec(`ALTER TABLE users ADD COLUMN pin TEXT`);
      console.log("✅ Added PIN column to users table");
    }
    
    // Don't auto-create admin user - let the setup process handle it
    // This allows for proper initial setup after factory reset
    const userCount = storeInfoDb.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    if (userCount.count === 0) {
      console.log("📌 No users found. Please complete initial setup to create admin user.");
    }
  }
  return storeInfoDb;
}

// Get inventory database (read-write for inventory tracking)
function getInventoryDb() {
  if (!inventoryDb) {
    inventoryDb = new Database(inventoryDbPath);
    // Create inventory table if it doesn't exist
    inventoryDb.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        upc TEXT NOT NULL UNIQUE,
        cost REAL NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_upc ON inventory(upc);
      
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        total REAL NOT NULL,
        payment_type TEXT NOT NULL CHECK(payment_type IN ('cash', 'debit', 'credit')),
        cash_given REAL,
        change_given REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by_user_id INTEGER,
        created_by_username TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(created_by_user_id);
      
      CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        upc TEXT NOT NULL,
        adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('purchase', 'sale', 'adjustment', 'initial', 'test_data', 'return', 'damage', 'theft')),
        quantity_change INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        cost REAL,
        price REAL,
        reference_id INTEGER,
        reference_type TEXT CHECK(reference_type IN ('transaction', 'manual', 'test')),
        notes TEXT,
        created_by TEXT DEFAULT 'system',
        created_by_user_id INTEGER,
        created_by_username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_adjustments_upc ON inventory_adjustments(upc);
      CREATE INDEX IF NOT EXISTS idx_adjustments_date ON inventory_adjustments(created_at);
      CREATE INDEX IF NOT EXISTS idx_adjustments_type ON inventory_adjustments(adjustment_type);
      CREATE INDEX IF NOT EXISTS idx_adjustments_user ON inventory_adjustments(created_by_user_id);
    `);
    
    // Create till management tables
    inventoryDb.exec(`
      CREATE TABLE IF NOT EXISTS till_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled INTEGER NOT NULL DEFAULT 0,
        ones INTEGER NOT NULL DEFAULT 0,
        fives INTEGER NOT NULL DEFAULT 0,
        tens INTEGER NOT NULL DEFAULT 0,
        twenties INTEGER NOT NULL DEFAULT 0,
        fifties INTEGER NOT NULL DEFAULT 0,
        hundreds INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS daily_till (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL UNIQUE,
        starting_ones INTEGER NOT NULL DEFAULT 0,
        starting_fives INTEGER NOT NULL DEFAULT 0,
        starting_tens INTEGER NOT NULL DEFAULT 0,
        starting_twenties INTEGER NOT NULL DEFAULT 0,
        starting_fifties INTEGER NOT NULL DEFAULT 0,
        starting_hundreds INTEGER NOT NULL DEFAULT 0,
        current_ones INTEGER NOT NULL DEFAULT 0,
        current_fives INTEGER NOT NULL DEFAULT 0,
        current_tens INTEGER NOT NULL DEFAULT 0,
        current_twenties INTEGER NOT NULL DEFAULT 0,
        current_fifties INTEGER NOT NULL DEFAULT 0,
        current_hundreds INTEGER NOT NULL DEFAULT 0,
        cash_transactions INTEGER NOT NULL DEFAULT 0,
        cash_in REAL NOT NULL DEFAULT 0,
        cash_out REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
      );
      CREATE INDEX IF NOT EXISTS idx_daily_till_date ON daily_till(date);
      
      CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        created_by_user_id INTEGER,
        created_by_username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_payouts_date ON payouts(created_at);
      
      CREATE TABLE IF NOT EXISTS employee_time_clock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        punch_in DATETIME NOT NULL,
        punch_out DATETIME,
        shift_date DATE NOT NULL,
        duration_minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_employee_clock_user ON employee_time_clock(user_id);
      CREATE INDEX IF NOT EXISTS idx_employee_clock_date ON employee_time_clock(shift_date);
    `);
    
    // Add migration for existing databases
    try {
      // Check if cash_in and cash_out columns exist in daily_till
      const tillInfo = inventoryDb.pragma("table_info(daily_till)");
      const hasCashIn = (tillInfo as any[]).some((col: any) => col.name === 'cash_in');
      const hasCashOut = (tillInfo as any[]).some((col: any) => col.name === 'cash_out');
      const hasStatus = (tillInfo as any[]).some((col: any) => col.name === 'status');
      const hasCashTransactions = (tillInfo as any[]).some((col: any) => col.name === 'cash_transactions');
      
      if (!hasCashIn) {
        inventoryDb.exec(`ALTER TABLE daily_till ADD COLUMN cash_in REAL NOT NULL DEFAULT 0`);
        console.log("✅ Added cash_in column to daily_till table");
      }
      
      if (!hasCashOut) {
        inventoryDb.exec(`ALTER TABLE daily_till ADD COLUMN cash_out REAL NOT NULL DEFAULT 0`);
        console.log("✅ Added cash_out column to daily_till table");
      }
      
      if (!hasStatus) {
        inventoryDb.exec(`ALTER TABLE daily_till ADD COLUMN status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed'))`);
        console.log("✅ Added status column to daily_till table");
      }
      
      if (!hasCashTransactions) {
        inventoryDb.exec(`ALTER TABLE daily_till ADD COLUMN cash_transactions INTEGER NOT NULL DEFAULT 0`);
        console.log("✅ Added cash_transactions column to daily_till table");
      }
      
      // Update any existing till records without status to be 'open'
      if (!hasStatus) {
        inventoryDb.exec(`UPDATE daily_till SET status = 'open' WHERE status IS NULL`);
        console.log("✅ Updated existing till records with 'open' status");
      }
      
      // Check if columns exist and add them if they don't
      const transactionsInfo = inventoryDb.pragma("table_info(transactions)");
      const hasUserTracking = (transactionsInfo as any[]).some((col: any) => col.name === 'created_by_user_id');
      
      if (!hasUserTracking) {
        inventoryDb.exec(`
          ALTER TABLE transactions ADD COLUMN created_by_user_id INTEGER;
          ALTER TABLE transactions ADD COLUMN created_by_username TEXT;
        `);
        console.log("✅ Added user tracking to transactions table");
      }
      
      const adjustmentsInfo = inventoryDb.pragma("table_info(inventory_adjustments)");
      const adjustmentsHasUserTracking = (adjustmentsInfo as any[]).some((col: any) => col.name === 'created_by_user_id');
      
      if (!adjustmentsHasUserTracking) {
        inventoryDb.exec(`
          ALTER TABLE inventory_adjustments ADD COLUMN created_by_user_id INTEGER;
          ALTER TABLE inventory_adjustments ADD COLUMN created_by_username TEXT;
        `);
        console.log("✅ Added user tracking to inventory_adjustments table");
      }
    } catch (err) {
      console.log("Migration check completed");
    }
    
    console.log("✅ Inventory database initialized at:", inventoryDbPath);
  }
  return inventoryDb;
}

// Product interface
interface Product {
  upc: string;
  category: string | null;
  description: string | null;
  volume: string | null;
  pack: number | null;
}

interface InventoryItem {
  upc: string;
  cost: number;
  price: number;
  quantity: number;
}

interface Transaction {
  id?: number;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_type: 'cash' | 'debit' | 'credit';
  cash_given?: number;
  change_given?: number;
  created_at?: string;
}

// Track current logged in user
let currentUser: { id: number; username: string; role: string } | null = null;

export function registerInventoryIpc(ipcMain: IpcMain) {
  // Only register handlers once
  if (handlersRegistered) {
    console.log("IPC handlers already registered, skipping...");
    return;
  }
  
  handlersRegistered = true;
  console.log("Registering IPC handlers...");

  // Check if store info exists
  ipcMain.handle("check-store-info", async () => {
    try {
      const storeDb = getStoreInfoDb();
      const storeInfo = storeDb.prepare("SELECT * FROM store_info LIMIT 1").get();
      
      return {
        success: true,
        hasStoreInfo: !!storeInfo,
        data: storeInfo || null
      };
    } catch (error) {
      console.error("Check store info error:", error);
      return {
        success: false,
        hasStoreInfo: false,
        error: error instanceof Error ? error.message : "Failed to check store info"
      };
    }
  });

  // Check if system needs initial setup (no auth required)
  ipcMain.handle("check-initial-setup", async () => {
    try {
      // First check if databases exist - if not, we need setup
      if (!fs.existsSync(storeInfoDbPath) || !fs.existsSync(inventoryDbPath)) {
        console.log("Initial setup check - Databases do not exist, needs setup");
        return {
          success: true,
          needsSetup: true,
          hasStoreInfo: false,
          hasUsers: false,
          userCount: 0,
          storeData: null
        };
      }
      
      const storeDb = getStoreInfoDb();
      
      // Check for store info
      const storeInfo = storeDb.prepare("SELECT * FROM store_info LIMIT 1").get();
      
      // Check for any users
      const userCount = storeDb.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      
      console.log("Initial setup check - Store info:", !!storeInfo, "User count:", userCount.count);
      
      return {
        success: true,
        needsSetup: !storeInfo || userCount.count === 0,
        hasStoreInfo: !!storeInfo,
        hasUsers: userCount.count > 0,
        userCount: userCount.count,
        storeData: storeInfo || null
      };
    } catch (error) {
      console.error("Check initial setup error:", error);
      return {
        success: false,
        needsSetup: true,
        error: error instanceof Error ? error.message : "Failed to check initial setup"
      };
    }
  });

  // Save store info
  ipcMain.handle("save-store-info", async (_, storeInfo) => {
    try {
      console.log("Saving store info:", storeInfo);
      const storeDb = getStoreInfoDb();
      
      // Check if store info already exists
      const existing = storeDb.prepare("SELECT id FROM store_info LIMIT 1").get();
      
      if (existing) {
        // Update existing
        const stmt = storeDb.prepare(`
          UPDATE store_info SET
            store_name = ?,
            address_line1 = ?,
            address_line2 = ?,
            city = ?,
            state = ?,
            zip_code = ?,
            phone_number = ?,
            tax_rate = ?,
            receipt_header = ?,
            receipt_footer = ?,
            last_modified = datetime('now')
          WHERE id = ?
        `);
        
        stmt.run(
          storeInfo.store_name,
          storeInfo.address_line1,
          storeInfo.address_line2 || null,
          storeInfo.city,
          storeInfo.state,
          storeInfo.zip_code,
          storeInfo.phone_number,
          storeInfo.tax_rate,
          storeInfo.receipt_header || null,
          storeInfo.receipt_footer || 'Thank you for your business!',
          (existing as any).id
        );
      } else {
        // Insert new
        const stmt = storeDb.prepare(`
          INSERT INTO store_info (
            store_name, address_line1, address_line2, city, state,
            zip_code, phone_number, tax_rate, receipt_header, receipt_footer
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          storeInfo.store_name,
          storeInfo.address_line1,
          storeInfo.address_line2 || null,
          storeInfo.city,
          storeInfo.state,
          storeInfo.zip_code,
          storeInfo.phone_number,
          storeInfo.tax_rate,
          storeInfo.receipt_header || null,
          storeInfo.receipt_footer || 'Thank you for your business!'
        );
      }
      
      return {
        success: true,
        message: "Store information saved successfully"
      };
    } catch (error) {
      console.error("Save store info error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save store info"
      };
    }
  });

  // Get store info
  ipcMain.handle("get-store-info", async () => {
    try {
      const storeDb = getStoreInfoDb();
      const storeInfo = storeDb.prepare("SELECT * FROM store_info LIMIT 1").get();
      
      return {
        success: true,
        data: storeInfo || null
      };
    } catch (error) {
      console.error("Get store info error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get store info"
      };
    }
  });

  // Import CSV data
  ipcMain.handle("import-csv", async () => {
    try {
      const csvPath = path.join(process.cwd(), "LiquorDatabase.csv");
      
      if (!fs.existsSync(csvPath)) {
        return {
          success: false,
          error: "LiquorDatabase.csv not found in project root"
        };
      }

      const csvFile = fs.readFileSync(csvPath, 'utf8');
      const { data, errors } = Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => {
          if (typeof value === 'string') {
            return value.replace(/^"|"$/g, '').trim();
          }
          return value;
        }
      });

      if (errors.length > 0) {
        console.error('CSV parsing errors:', errors);
      }

      // Close existing products connection and create writable one
      if (productsDb) {
        productsDb.close();
        productsDb = null;
      }

      const newDb = new Database(productsDbPath);
      
      // Create table with EXACT column names
      newDb.exec(`
        DROP TABLE IF EXISTS products;
        CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          "Item Number" TEXT,
          "Category Name" TEXT,
          "Item Description" TEXT,
          "Vendor" TEXT,
          "Vendor Name" TEXT,
          "Bottle Volume (ml)" TEXT,
          "Pack" INTEGER,
          "Inner Pack" INTEGER,
          "Age" TEXT,
          "Proof" TEXT,
          "List Date" TEXT,
          "UPC" TEXT,
          "SCC" TEXT,
          "State Bottle Cost" REAL,
          "State Case Cost" REAL,
          "State Bottle Retail" REAL,
          "Report Date" TEXT
        );
        
        CREATE INDEX idx_upc ON products("UPC");
        CREATE INDEX idx_description ON products("Item Description");
      `);

      const insert = newDb.prepare(`
        INSERT INTO products (
          "Item Number",
          "Category Name", 
          "Item Description",
          "Vendor",
          "Vendor Name",
          "Bottle Volume (ml)",
          "Pack",
          "Inner Pack",
          "Age",
          "Proof",
          "List Date",
          "UPC",
          "SCC",
          "State Bottle Cost",
          "State Case Cost",
          "State Bottle Retail",
          "Report Date"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = newDb.transaction((rows: Record<string, unknown>[]) => {
        for (const row of rows) {
          insert.run(
            row['Item Number'] || null,
            row['Category Name'] || null,
            row['Item Description'] || null,
            row['Vendor'] || null,
            row['Vendor Name'] || null,
            row['Bottle Volume (ml)'] || null,
            parseInt(String(row['Pack'])) || null,
            parseInt(String(row['Inner Pack'])) || null,
            row['Age'] || null,
            row['Proof'] || null,
            row['List Date'] || null,
            row['UPC'] || null,
            row['SCC'] || null,
            parseFloat(String(row['State Bottle Cost'])) || null,
            parseFloat(String(row['State Case Cost'])) || null,
            parseFloat(String(row['State Bottle Retail'])) || null,
            row['Report Date'] || null
          );
        }
      });

      insertMany(data as Record<string, unknown>[]);
      
      const count = newDb.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
      
      newDb.close();
      productsDb = null; // Reset to force reconnection

      return {
        success: true,
        message: `Successfully imported ${count.count} products`,
        count: count.count
      };
    } catch (error) {
      console.error("Import error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Import failed"
      };
    }
  });

  // Search product by UPC
  ipcMain.handle("search-by-upc", async (_, upc: string) => {
    try {
      const prodDb = getProductsDb();
      const invDb = getInventoryDb();
      
      // Search in products database
      const query = `
        SELECT 
          "UPC" as upc,
          "Category Name" as category,
          "Item Description" as description,
          "Bottle Volume (ml)" as volume,
          "Pack" as pack
        FROM products 
        WHERE "UPC" = ?
      `;
      
      const product = prodDb.prepare(query).get(upc) as Product | undefined;
      
      if (product) {
        // Check if already in inventory database
        const inventoryCheck = invDb.prepare(`
          SELECT * FROM inventory WHERE upc = ?
        `).get(upc);
        
        console.log("Found product:", product);
        console.log("In inventory:", !!inventoryCheck);
        
        return {
          success: true,
          data: product,
          inInventory: !!inventoryCheck
        };
      } else {
        return {
          success: false,
          error: "Product not found"
        };
      }
    } catch (error) {
      console.error("Database error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Database error"
      };
    }
  });

  // Get all inventory items
  ipcMain.handle("get-inventory", async () => {
    try {
      const invDb = getInventoryDb();
      const prodDb = getProductsDb();
      
      // Get all inventory items with product details
      const inventoryItems = invDb.prepare(`
        SELECT 
          i.id,
          i.upc,
          i.cost,
          i.price,
          i.quantity,
          i.updated_at
        FROM inventory i
        ORDER BY i.updated_at DESC
      `).all();
      
      // Enrich with product details
      const enrichedItems = (inventoryItems as Record<string, unknown>[]).map((item: Record<string, unknown>) => {
        const product = prodDb.prepare(`
          SELECT 
            "Item Description" as description,
            "Category Name" as category,
            "Bottle Volume (ml)" as volume
          FROM products 
          WHERE "UPC" = ?
        `).get(item.upc as string) as { description?: string; category?: string; volume?: string } | undefined;
        
        return {
          ...item,
          description: product?.description || null,
          category: product?.category || null,
          volume: product?.volume || null
        };
      });
      
      return {
        success: true,
        data: enrichedItems
      };
    } catch (error) {
      console.error("Get inventory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load inventory"
      };
    }
  });

  // Check if item exists in inventory (for cart scanner)
  ipcMain.handle("check-inventory", async (_, upc: string) => {
    try {
      const invDb = getInventoryDb();
      
      // Check if item exists in inventory
      const inventoryItem = invDb.prepare(`
        SELECT * FROM inventory WHERE upc = ?
      `).get(upc) as InventoryItem | undefined;
      
      if (inventoryItem) {
        // Get product details from products database
        const prodDb = getProductsDb();
        const product = prodDb.prepare(`
          SELECT 
            "Item Description" as description,
            "Category Name" as category,
            "Bottle Volume (ml)" as volume
          FROM products 
          WHERE "UPC" = ?
        `).get(upc) as { description?: string; category?: string; volume?: string } | undefined;
        
        return {
          success: true,
          data: {
            upc: inventoryItem.upc,
            description: product?.description || null,
            category: product?.category || null,
            volume: product?.volume || null,
            cost: inventoryItem.cost,
            price: inventoryItem.price,
            quantity: inventoryItem.quantity
          }
        };
      } else {
        return {
          success: false,
          error: "Item not in inventory"
        };
      }
    } catch (error) {
      console.error("Check inventory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check inventory"
      };
    }
  });

  // Search inventory by description
  ipcMain.handle("search-inventory-by-description", async (_, searchTerm: string) => {
    try {
      const invDb = getInventoryDb();
      const prodDb = getProductsDb();
      
      // Get all inventory items
      const inventoryItems = invDb.prepare(`
        SELECT * FROM inventory WHERE quantity > 0
      `).all() as InventoryItem[];
      
      // Search and enrich with product details
      const searchResults = [];
      for (const item of inventoryItems) {
        const product = prodDb.prepare(`
          SELECT 
            "Item Description" as description,
            "Category Name" as category,
            "Bottle Volume (ml)" as volume
          FROM products 
          WHERE "UPC" = ?
        `).get(item.upc) as { description?: string; category?: string; volume?: string } | undefined;
        
        if (product?.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) {
          searchResults.push({
            upc: item.upc,
            description: product.description,
            category: product.category || null,
            volume: product.volume || null,
            cost: item.cost,
            price: item.price,
            quantity: item.quantity
          });
        }
      }
      
      // Limit to 10 results
      return {
        success: true,
        data: searchResults.slice(0, 10)
      };
    } catch (error) {
      console.error("Search inventory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search inventory"
      };
    }
  });

  // Search products directly from products database (for test data generation)
  ipcMain.handle("search-products-by-category", async (_, category: string) => {
    try {
      const prodDb = getProductsDb();
      
      // Search products by category or description
      const products = prodDb.prepare(`
        SELECT 
          "UPC" as upc,
          "Item Description" as description,
          "Category Name" as category,
          "Bottle Volume (ml)" as volume,
          "Pack" as pack,
          "State Bottle Retail" as price
        FROM products 
        WHERE "Category Name" LIKE ? OR "Item Description" LIKE ?
        LIMIT 100
      `).all(`%${category}%`, `%${category}%`) as Array<{
        upc: string;
        description: string;
        category: string | null;
        volume: string | null;
        pack: number | null;
        price: number | null;
      }>;
      
      // Convert to proper format with cost calculation
      const formattedProducts = products.map(p => ({
        upc: p.upc,
        description: p.description,
        category: p.category,
        volume: p.volume,
        pack: p.pack,
        cost: p.price ? p.price * 0.7 : 10, // Assume 30% markup, or default $10
        price: p.price || 15 // Default $15 if no price
      }));
      
      return {
        success: true,
        data: formattedProducts
      };
    } catch (error) {
      console.error("Search products error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search products"
      };
    }
  });

  // Add to inventory
  ipcMain.handle("add-to-inventory", async (_, item: InventoryItem) => {
    try {
      const invDb = getInventoryDb();
      
      // Start transaction for data consistency
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        // Check if already exists in inventory
        const existing = invDb.prepare(`
          SELECT * FROM inventory WHERE upc = ?
        `).get(item.upc) as InventoryItem & { quantity: number } | undefined;
        
        const quantityBefore = existing ? existing.quantity : 0;
        const quantityAfter = quantityBefore + item.quantity;
        
        if (existing) {
          // Update existing record
          const stmt = invDb.prepare(`
            UPDATE inventory 
            SET quantity = quantity + ?, 
                cost = ?, 
                price = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE upc = ?
          `);
          stmt.run(item.quantity, item.cost, item.price, item.upc);
        } else {
          // Insert new record
          const stmt = invDb.prepare(`
            INSERT INTO inventory (upc, cost, price, quantity)
            VALUES (?, ?, ?, ?)
          `);
          stmt.run(item.upc, item.cost, item.price, item.quantity);
        }
        
        // Record the adjustment with user info
        const adjustmentStmt = invDb.prepare(`
          INSERT INTO inventory_adjustments (
            upc, adjustment_type, quantity_change, quantity_before, quantity_after,
            cost, price, reference_type, notes, created_by_user_id, created_by_username
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        adjustmentStmt.run(
          item.upc,
          'purchase',  // Manual additions are considered purchases
          item.quantity,
          quantityBefore,
          quantityAfter,
          item.cost,
          item.price,
          'manual',
          'Manual inventory addition',
          currentUser?.id || null,
          currentUser?.username || 'system'
        );
        
        invDb.prepare("COMMIT").run();
        
        return {
          success: true,
          message: `Inventory updated! Added ${item.quantity} units.`,
          updated: !!existing
        };
      } catch (error) {
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Add to inventory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add to inventory"
      };
    }
  });

  // Save transaction
  ipcMain.handle("save-transaction", async (_, transaction: Transaction) => {
    try {
      const invDb = getInventoryDb();
      
      // Start a transaction for data consistency
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        // Parse the items to deduct from inventory
        const items = JSON.parse(transaction.items);
        
        // Save the transaction first to get the ID (with user info)
        const stmt = invDb.prepare(`
          INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given, created_by_user_id, created_by_username)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
          transaction.items,
          transaction.subtotal,
          transaction.tax,
          transaction.total,
          transaction.payment_type,
          transaction.cash_given || null,
          transaction.change_given || null,
          currentUser?.id || null,
          currentUser?.username || 'system'
        );
        
        const transactionId = result.lastInsertRowid;
        
        // Deduct each item from inventory and record adjustments
        for (const item of items) {
          // Skip inventory checks for special items that don't track inventory
          const specialPrefixes = ['PAYOUT_', 'LOTTERY-', 'MISC-TAX-', 'MISC-NONTAX-'];
          const isSpecialItem = specialPrefixes.some(prefix => item.upc.startsWith(prefix));
          
          // Skip inventory checks for payout/credit items or special items
          if (item.price < 0 || isSpecialItem) {
            continue; // These don't affect inventory
          }
          
          // Check current quantity and get item details
          const currentItem = invDb.prepare(`
            SELECT quantity, cost, price FROM inventory WHERE upc = ?
          `).get(item.upc) as { quantity: number; cost: number; price: number } | undefined;
          
          if (!currentItem) {
            throw new Error(`Item with UPC ${item.upc} not found in inventory`);
          }
          
          const newQuantity = currentItem.quantity - item.quantity;
          
          if (newQuantity < 0) {
            throw new Error(`Insufficient inventory for ${item.description}. Available: ${currentItem.quantity}, Requested: ${item.quantity}`);
          }
          
          // Update inventory quantity
          const updateStmt = invDb.prepare(`
            UPDATE inventory 
            SET quantity = ?, updated_at = datetime('now')
            WHERE upc = ?
          `);
          
          updateStmt.run(newQuantity, item.upc);
          
          // Record the adjustment for this sale with user info
          const adjustmentStmt = invDb.prepare(`
            INSERT INTO inventory_adjustments (
              upc, adjustment_type, quantity_change, quantity_before, quantity_after,
              cost, price, reference_id, reference_type, notes, created_by_user_id, created_by_username
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          adjustmentStmt.run(
            item.upc,
            'sale',
            -item.quantity,  // Negative for sales
            currentItem.quantity,
            newQuantity,
            currentItem.cost,
            item.price || currentItem.price,
            transactionId,
            'transaction',
            `Sale - Transaction #${transactionId}`,
            currentUser?.id || null,
            currentUser?.username || 'system'
          );
        }
        
        // Commit the transaction
        invDb.prepare("COMMIT").run();
        
        // Update till if payment was cash
        if (transaction.payment_type === 'cash') {
          // Update till with the cash amount
          await updateTillForCashTransaction(transaction.total, false);
        }
        
        return {
          success: true,
          transactionId: result.lastInsertRowid,
          message: "Transaction saved and inventory updated successfully"
        };
      } catch (error) {
        // Rollback on any error
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Save transaction error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save transaction"
      };
    }
  });

  // Get all transactions
  ipcMain.handle("get-transactions", async () => {
    try {
      const invDb = getInventoryDb();
      
      const transactions = invDb.prepare(`
        SELECT 
          id,
          items,
          subtotal,
          tax,
          total,
          payment_type,
          cash_given,
          change_given,
          created_by_user_id,
          created_by_username,
          datetime(created_at, 'localtime') as created_at
        FROM transactions
        ORDER BY datetime(created_at) DESC, id DESC
      `).all();
      
      return {
        success: true,
        data: transactions
      };
    } catch (error) {
      console.error("Get transactions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load transactions"
      };
    }
  });

  // Get inventory adjustments
  ipcMain.handle("get-inventory-adjustments", async (_, filters?: { upc?: string; type?: string }) => {
    try {
      const invDb = getInventoryDb();
      const prodDb = getProductsDb();
      
      let query = `
        SELECT 
          a.*,
          datetime(a.created_at, 'localtime') as created_at_local
        FROM inventory_adjustments a
      `;
      
      const conditions = [];
      const params = [];
      
      if (filters?.upc) {
        conditions.push("a.upc = ?");
        params.push(filters.upc);
      }
      
      if (filters?.type) {
        conditions.push("a.adjustment_type = ?");
        params.push(filters.type);
      }
      
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      
      query += " ORDER BY a.created_at DESC LIMIT 500";
      
      const adjustments = invDb.prepare(query).all(...params);
      
      // Enrich with product descriptions
      const enrichedAdjustments = adjustments.map((adj: any) => {
        let productInfo = null;
        try {
          productInfo = prodDb.prepare(`
            SELECT "Item Description" as description, "Category Name" as category
            FROM products WHERE "UPC" = ?
          `).get(adj.upc) as any;
        } catch (err) {
          // Products database might not be available
        }
        
        return {
          ...adj,
          description: productInfo?.description || 'Unknown Item',
          category: productInfo?.category || null
        };
      });
      
      return {
        success: true,
        data: enrichedAdjustments
      };
    } catch (error) {
      console.error("Get inventory adjustments error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get adjustments"
      };
    }
  });

  // Get inventory transactions (shows where inventory went)
  ipcMain.handle("get-inventory-transactions", async () => {
    try {
      const invDb = getInventoryDb();
      
      // Get all transactions and parse their items
      const transactions = invDb.prepare(`
        SELECT 
          id as transaction_id,
          items,
          payment_type,
          total,
          datetime(created_at, 'localtime') as created_at
        FROM transactions
        ORDER BY created_at DESC
      `).all();
      
      // Parse items from each transaction to create inventory movement records
      const inventoryTransactions = [];
      
      for (const transaction of transactions) {
        try {
          const items = JSON.parse((transaction as any).items as string);
          for (const item of items) {
            // Get product details from the products database if available
            let product = null;
            try {
              const prodDb = getProductsDb();
              product = prodDb.prepare(`
                SELECT description, category, volume
                FROM products
                WHERE upc = ?
              `).get(item.upc) as any;
            } catch (err) {
              // Products database might not be available
              console.log("Could not fetch product details:", err);
            }
            
            inventoryTransactions.push({
              transaction_id: (transaction as any).transaction_id,
              upc: item.upc,
              description: item.description || product?.description || 'Unknown Item',
              category: product?.category || null,
              volume: product?.volume || null,
              quantity: item.quantity,
              unit_price: item.price,
              total: item.total,
              payment_type: (transaction as any).payment_type,
              transaction_total: (transaction as any).total,
              created_at: (transaction as any).created_at
            });
          }
        } catch (err) {
          console.error("Error parsing transaction items:", err);
        }
      }
      
      return {
        success: true,
        data: inventoryTransactions
      };
    } catch (error) {
      console.error("Get inventory transactions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get inventory transactions"
      };
    }
  });

  // Get daily sales report
  ipcMain.handle("get-daily-sales", async (_, date: string) => {
    try {
      const invDb = getInventoryDb();
      const prodDb = getProductsDb();
      
      // Get all transactions for the specified date
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;
      
      const transactions = invDb.prepare(`
        SELECT * FROM transactions 
        WHERE datetime(created_at) >= datetime(?) 
        AND datetime(created_at) <= datetime(?)
        ORDER BY created_at
      `).all(startDate, endDate) as any[];
      
      if (transactions.length === 0) {
        return {
          success: true,
          data: {
            date,
            totalSales: 0,
            salesCount: 0,
            itemsSold: 0,
            avgSaleAmount: 0,
            totalTax: 0,
            paymentBreakdown: { cash: 0, debit: 0, credit: 0 },
            hourlyBreakdown: [],
            topProducts: []
          }
        };
      }
      
      // Calculate metrics
      let totalSales = 0;
      let totalTax = 0;
      let itemsSold = 0;
      const paymentBreakdown = { cash: 0, debit: 0, credit: 0 };
      const hourlyData: Record<number, { sales: number; amount: number }> = {};
      const productSales: Record<string, { description: string; quantity: number; revenue: number }> = {};
      
      for (const transaction of transactions) {
        totalSales += transaction.total;
        totalTax += transaction.tax;
        
        // Payment breakdown
        paymentBreakdown[transaction.payment_type as keyof typeof paymentBreakdown] += transaction.total;
        
        // Hourly breakdown
        const hour = new Date(transaction.created_at).getHours();
        if (!hourlyData[hour]) {
          hourlyData[hour] = { sales: 0, amount: 0 };
        }
        hourlyData[hour].sales++;
        hourlyData[hour].amount += transaction.total;
        
        // Parse items for product analysis
        try {
          const items = JSON.parse(transaction.items);
          for (const item of items) {
            itemsSold += item.quantity;
            
            if (!productSales[item.upc]) {
              // Try to get product description from database
              let description = item.description || 'Unknown Product';
              try {
                const product = prodDb.prepare(`
                  SELECT "Item Description" as description 
                  FROM products WHERE "UPC" = ?
                `).get(item.upc) as any;
                if (product?.description) {
                  description = product.description;
                }
              } catch (err) {
                // Use fallback description
              }
              
              productSales[item.upc] = {
                description,
                quantity: 0,
                revenue: 0
              };
            }
            productSales[item.upc].quantity += item.quantity;
            productSales[item.upc].revenue += item.total || (item.price * item.quantity);
          }
        } catch (err) {
          console.error('Error parsing transaction items:', err);
        }
      }
      
      // Format hourly breakdown
      const hourlyBreakdown = Object.entries(hourlyData).map(([hour, data]) => ({
        hour: parseInt(hour),
        sales: data.sales,
        amount: data.amount
      }));
      
      // Get top 10 products by quantity sold, then by revenue if quantities are equal
      const topProducts = Object.entries(productSales)
        .map(([upc, data]) => ({ upc, ...data }))
        .sort((a, b) => {
          // First sort by quantity (descending)
          if (b.quantity !== a.quantity) {
            return b.quantity - a.quantity;
          }
          // If quantities are equal, sort by revenue (descending)
          return b.revenue - a.revenue;
        })
        .slice(0, 10);
      
      const avgSaleAmount = totalSales / transactions.length;
      
      return {
        success: true,
        data: {
          date,
          totalSales,
          salesCount: transactions.length,
          itemsSold,
          avgSaleAmount,
          totalTax,
          paymentBreakdown,
          hourlyBreakdown,
          topProducts
        }
      };
    } catch (error) {
      console.error("Get daily sales error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get daily sales"
      };
    }
  });

  // Register test inventory handlers
  registerGenerateTestInventory(ipcMain);
  // Removed - now handled in main registerInventoryIpc function with better implementation
  registerGenerateTestSales(ipcMain);
  // Removed - now handled in main registerInventoryIpc function with better implementation
  // registerClearTransactions(ipcMain);
  // registerClearAllData(ipcMain);
  registerWeeklySummary(ipcMain);
  registerInventoryAnalysis(ipcMain);
  registerUserManagement(ipcMain);
  registerTimeClock(ipcMain);
}

// Generate test inventory for development
function registerGenerateTestInventory(ipcMain: IpcMain) {
  ipcMain.handle("generate-test-inventory", async (_, params: {
    itemCount: number;
    minCost: number;
    maxCost: number;
    markupPercentage: number;
    minQuantity: number;
    maxQuantity: number;
  }) => {
    try {
      // Initialize databases if needed
      const prodDb = getProductsDb();
      const invDb = getInventoryDb();

      // Get random products from the catalog
      const randomProducts = prodDb.prepare(`
        SELECT "UPC" as upc, "Item Description" as description, "Bottle Volume (ml)" as size
        FROM products
        WHERE "UPC" IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
      `).all(params.itemCount) as Array<{
        upc: string;
        description: string | null;
        size: string | null;
      }>;

      if (randomProducts.length === 0) {
        return {
          success: false,
          error: "No products found in catalog. Please import product data first."
        };
      }

      // Begin transaction for bulk insert with adjustments
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        const insertStmt = invDb.prepare(`
          INSERT OR REPLACE INTO inventory (upc, cost, price, quantity)
          VALUES (?, ?, ?, ?)
        `);
        
        const adjustmentStmt = invDb.prepare(`
          INSERT INTO inventory_adjustments (
            upc, adjustment_type, quantity_change, quantity_before, quantity_after,
            cost, price, reference_type, notes, created_by_user_id, created_by_username
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // Generate random inventory data
        let itemsAdded = 0;
        
        for (const product of randomProducts) {
          // Check if item already exists
          const existing = invDb.prepare(`
            SELECT quantity FROM inventory WHERE upc = ?
          `).get(product.upc) as { quantity: number } | undefined;
          
          const quantityBefore = existing ? existing.quantity : 0;
          
          // Generate random cost within range
          const cost = params.minCost + Math.random() * (params.maxCost - params.minCost);
          // Calculate price with markup
          const price = cost * (1 + params.markupPercentage / 100);
          // Generate random quantity within range
          const quantity = Math.floor(params.minQuantity + Math.random() * (params.maxQuantity - params.minQuantity + 1));
          
          const finalCost = parseFloat(cost.toFixed(2));
          const finalPrice = parseFloat(price.toFixed(2));
          
          // Insert or update inventory
          if (existing) {
            // Update existing - add to current quantity
            invDb.prepare(`
              UPDATE inventory 
              SET quantity = quantity + ?, cost = ?, price = ?, updated_at = CURRENT_TIMESTAMP
              WHERE upc = ?
            `).run(quantity, finalCost, finalPrice, product.upc);
          } else {
            // Insert new
            insertStmt.run(product.upc, finalCost, finalPrice, quantity);
          }
          
          // Record adjustment with user info
          adjustmentStmt.run(
            product.upc,
            'test_data',
            quantity,
            quantityBefore,
            quantityBefore + quantity,
            finalCost,
            finalPrice,
            'test',
            `Test data generation - ${product.description || 'Unknown'}`,
            currentUser?.id || null,
            currentUser?.username || 'system'
          );
          
          itemsAdded++;
        }
        
        invDb.prepare("COMMIT").run();
        
        return {
          success: true,
          itemsAdded: itemsAdded
        };
      } catch (error) {
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Error generating test inventory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate test inventory"
      };
    }
  });
}

// Removed old registerClearInventory - now handled in main registerInventoryIpc function

// Generate test sales for development
function registerGenerateTestSales(ipcMain: IpcMain) {
  ipcMain.handle("generate-test-sales", async (_, params: {
    numberOfSales: number;
    minItemsPerSale: number;
    maxItemsPerSale: number;
    startDate: string;
    endDate: string;
    paymentTypes: string[];
  }) => {
    try {
      const invDb = getInventoryDb();
      const storeDb = getStoreInfoDb();
      const prodDb = getProductsDb();
      
      // Get store info for tax rate
      const storeInfo = storeDb.prepare("SELECT tax_rate FROM store_info LIMIT 1").get() as { tax_rate: number } | undefined;
      const taxRate = storeInfo?.tax_rate || 6.0;
      
      // Track current inventory levels in memory to avoid overselling
      const inventoryTracker = new Map<string, { price: number; quantity: number; description?: string }>();
      
      // Get available inventory items with quantity > 0
      const availableItems = invDb.prepare(`
        SELECT upc, price, quantity FROM inventory 
        WHERE quantity > 0
        ORDER BY RANDOM()
      `).all() as Array<{ upc: string; price: number; quantity: number }>;
      
      if (availableItems.length === 0) {
        return {
          success: false,
          error: "No inventory available to create sales. Please add inventory first."
        };
      }
      
      // Initialize the tracker with current inventory and get descriptions
      for (const item of availableItems) {
        // Try to get product description
        let description = `Test Item ${item.upc}`;
        try {
          const product = prodDb.prepare(`
            SELECT "Item Description" as description 
            FROM products WHERE "UPC" = ?
          `).get(item.upc) as { description?: string } | undefined;
          if (product?.description) {
            description = product.description;
          }
        } catch (err) {
          // Use fallback description
        }
        
        inventoryTracker.set(item.upc, {
          price: item.price,
          quantity: item.quantity,
          description
        });
      }
      
      let salesCreated = 0;
      let salesFailed = 0;
      let totalItemsSold = 0;
      let totalValue = 0;
      const failureReasons: string[] = [];
      
      // Calculate date range in milliseconds
      const startTime = new Date(params.startDate).getTime();
      const endTime = new Date(params.endDate + 'T23:59:59').getTime();
      const dateRange = endTime - startTime;
      
      // First, generate all sales with their dates (but don't select items yet)
      type PreparedSale = {
        saleDate: Date;
        saleNum: number;
        itemCount: number;
        paymentType: string;
      };
      
      const preparedSales: PreparedSale[] = [];
      
      // Generate sales with dates and basic parameters
      for (let saleNum = 0; saleNum < params.numberOfSales; saleNum++) {
        // Generate random timestamp within the date range
        const randomTime = startTime + Math.random() * dateRange;
        const saleDate = new Date(randomTime);
        
        // Random number of items for this sale
        const itemCount = params.minItemsPerSale + 
          Math.floor(Math.random() * (params.maxItemsPerSale - params.minItemsPerSale + 1));
        
        // Random payment type
        const paymentType = params.paymentTypes[Math.floor(Math.random() * params.paymentTypes.length)];
        
        preparedSales.push({
          saleDate,
          saleNum,
          itemCount,
          paymentType
        });
      }
      
      // Sort all prepared sales by date (chronological order)
      preparedSales.sort((a, b) => a.saleDate.getTime() - b.saleDate.getTime());
      
      // Now process the sorted sales so transaction IDs match chronological order
      for (const sale of preparedSales) {
        // Get items that still have inventory (check current state for each sale)
        const availableUPCs = Array.from(inventoryTracker.entries())
          .filter(([_, data]) => data.quantity > 0)
          .map(([upc, _]) => upc);
        
        if (availableUPCs.length === 0) {
          salesFailed++;
          failureReasons.push(`Sale #${sale.saleNum + 1}: No inventory available`);
          continue;
        }
        
        // Select random items for this sale
        const saleItems = [];
        const usedUPCs = new Set<string>();
        
        for (let i = 0; i < sale.itemCount && i < availableUPCs.length; i++) {
          // Find an item we haven't used in this sale yet
          let item = null;
          let attempts = 0;
          
          while (attempts < 50 && availableUPCs.length > usedUPCs.size) {
            const randomUPC = availableUPCs[Math.floor(Math.random() * availableUPCs.length)];
            if (!usedUPCs.has(randomUPC)) {
              const trackedItem = inventoryTracker.get(randomUPC);
              if (trackedItem && trackedItem.quantity > 0) {
                item = { upc: randomUPC, ...trackedItem };
                usedUPCs.add(randomUPC);
                break;
              }
            }
            attempts++;
          }
          
          if (!item) continue;
          
          // Random quantity (1-3 or available, whichever is less)
          const maxQty = Math.min(3, item.quantity);
          const quantity = Math.ceil(Math.random() * maxQty);
          
          saleItems.push({
            upc: item.upc,
            description: item.description || `Test Item ${item.upc}`,
            price: item.price,
            quantity: quantity,
            total: item.price * quantity
          });
        }
        
        if (saleItems.length === 0) {
          salesFailed++;
          failureReasons.push(`Sale #${sale.saleNum + 1}: Could not find any items to add`);
          continue;
        }
        
        // Calculate totals
        const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;
        
        // For cash payments, simulate cash given
        let cashGiven = null;
        let changeGiven = null;
        if (sale.paymentType === 'cash') {
          // Round up to nearest $5 or $10
          const roundTo = total > 50 ? 10 : 5;
          cashGiven = Math.ceil(total / roundTo) * roundTo;
          changeGiven = cashGiven - total;
        }
        
        // Create the transaction
        const transaction = {
          items: JSON.stringify(saleItems),
          subtotal,
          tax,
          total,
          payment_type: sale.paymentType,
          cash_given: cashGiven,
          change_given: changeGiven
        };
        
        // Save transaction directly using the same logic as save-transaction handler
        invDb.prepare("BEGIN TRANSACTION").run();
        
        try {
          // Verify inventory availability one more time before committing
          for (const item of saleItems) {
            const currentItem = invDb.prepare(`
              SELECT quantity, cost, price FROM inventory WHERE upc = ?
            `).get(item.upc) as { quantity: number; cost: number; price: number } | undefined;
            
            if (!currentItem || currentItem.quantity < item.quantity) {
              throw new Error(`Insufficient inventory for ${item.description} (UPC: ${item.upc}). Requested: ${item.quantity}, Available: ${currentItem?.quantity || 0}`);
            }
          }
          
          // Save the transaction with specific date
          const stmt = invDb.prepare(`
            INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given, created_at, created_by_user_id, created_by_username)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const result = stmt.run(
            transaction.items,
            transaction.subtotal,
            transaction.tax,
            transaction.total,
            transaction.payment_type,
            transaction.cash_given,
            transaction.change_given,
            sale.saleDate.toISOString(),
            null,  // No specific user ID for test data
            'test_generator'
          );
          
          const transactionId = result.lastInsertRowid;
          
          // Deduct items from inventory and record adjustments
          for (const item of saleItems) {
            const currentItem = invDb.prepare(`
              SELECT quantity, cost, price FROM inventory WHERE upc = ?
            `).get(item.upc) as { quantity: number; cost: number; price: number };
            
            const newQuantity = currentItem.quantity - item.quantity;
            
            // Update inventory
            invDb.prepare(`
              UPDATE inventory 
              SET quantity = ?, updated_at = datetime('now')
              WHERE upc = ?
            `).run(newQuantity, item.upc);
            
            
            // Update our tracker to reflect the sale
            const trackedItem = inventoryTracker.get(item.upc);
            if (trackedItem) {
              trackedItem.quantity = newQuantity;
            }
            
            // Record adjustment with same date as transaction and user info
            invDb.prepare(`
              INSERT INTO inventory_adjustments (
                upc, adjustment_type, quantity_change, quantity_before, quantity_after,
                cost, price, reference_id, reference_type, notes, created_at, created_by_user_id, created_by_username
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              item.upc,
              'sale',
              -item.quantity,
              currentItem.quantity,
              newQuantity,
              currentItem.cost,
              item.price,
              transactionId,
              'transaction',
              `Test Sale - Transaction #${transactionId}`,
              sale.saleDate.toISOString(),
              currentUser?.id || null,
              currentUser?.username || 'system'
            );
            
            totalItemsSold += item.quantity;
          }
          
          invDb.prepare("COMMIT").run();
          salesCreated++;
          totalValue += total;
        } catch (error) {
          invDb.prepare("ROLLBACK").run();
          salesFailed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failureReasons.push(`Sale #${sale.saleNum + 1}: ${errorMessage}`);
          
          // If we got an insufficient inventory error, update our tracker
          if (errorMessage.includes('Insufficient inventory')) {
            // Re-sync tracker with actual database state
            for (const [upc, data] of inventoryTracker.entries()) {
              const current = invDb.prepare(`
                SELECT quantity FROM inventory WHERE upc = ?
              `).get(upc) as { quantity: number } | undefined;
              if (current) {
                data.quantity = current.quantity;
              }
            }
          }
        }
      }
      
      // Prepare detailed result message
      let message = `Created ${salesCreated} sales`;
      if (salesFailed > 0) {
        message += `, ${salesFailed} failed`;
        if (failureReasons.length > 0 && failureReasons.length <= 5) {
          message += `. Reasons: ${failureReasons.join('; ')}`;
        } else if (failureReasons.length > 5) {
          message += `. First 5 failures: ${failureReasons.slice(0, 5).join('; ')}`;
        }
      }
      
      return {
        success: true,
        salesCreated,
        salesFailed,
        totalItems: totalItemsSold,
        totalValue,
        message
      };
    } catch (error) {
      console.error("Error generating test sales:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate test sales"
      };
    }
  });
}

// Removed old registerClearTransactions - now handled in main registerInventoryIpc function

// Removed old registerClearAllData - now handled in main registerInventoryIpc function

// Get Inventory Analysis handler
function registerInventoryAnalysis(ipcMain: IpcMain) {
  ipcMain.handle("get-inventory-analysis", async () => {
    try {
      const invDb = getInventoryDb();
      const productsDb = getProductsDb();
      
      // Get all inventory items
      const items = invDb.prepare(`
        SELECT 
          upc,
          cost,
          price,
          quantity,
          updated_at
        FROM inventory
        WHERE quantity >= 0
      `).all() as Array<{
        upc: string;
        cost: number;
        price: number;
        quantity: number;
        updated_at: string;
      }>;
      
      // Get sales data for turnover calculation (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const salesData = invDb.prepare(`
        SELECT 
          json_extract(item.value, '$.upc') as upc,
          SUM(json_extract(item.value, '$.quantity')) as sold_quantity
        FROM transactions t,
             json_each(t.items) item
        WHERE t.created_at >= ?
        GROUP BY upc
      `).all(thirtyDaysAgo.toISOString()) as Array<{
        upc: string;
        sold_quantity: number;
      }>;
      
      // Create a map of sales data
      const salesMap = new Map(salesData.map(s => [s.upc, s.sold_quantity]));
      
      // Get last sale date for each item
      const lastSales = invDb.prepare(`
        SELECT 
          json_extract(item.value, '$.upc') as upc,
          MAX(t.created_at) as last_sold
        FROM transactions t,
             json_each(t.items) item
        GROUP BY upc
      `).all() as Array<{
        upc: string;
        last_sold: string;
      }>;
      
      const lastSaleMap = new Map(lastSales.map(s => [s.upc, s.last_sold]));
      
      // Get categories and descriptions from products database
      const categoryMap = new Map<string, string>();
      const descriptionMap = new Map<string, string>();
      if (productsDb) {
        try {
          const products = productsDb.prepare(`
            SELECT 
              "UPC" as upc, 
              "Category Name" as category,
              "Item Description" as description
            FROM products
          `).all() as Array<{ upc: string; category: string | null; description: string | null }>;
          
          products.forEach(p => {
            if (p.category) categoryMap.set(p.upc, p.category);
            if (p.description) descriptionMap.set(p.upc, p.description);
          });
        } catch (err) {
          console.log("Could not fetch product data:", err);
        }
      }
      
      // Process inventory items
      const processedItems = items.map(item => {
        const value = item.quantity * item.price;
        const margin = item.price > 0 ? ((item.price - item.cost) / item.price) * 100 : 0;
        const soldQuantity = salesMap.get(item.upc) || 0;
        const turnoverRate = item.quantity > 0 ? (soldQuantity / item.quantity) : 0;
        const lastSold = lastSaleMap.get(item.upc) || null;
        const category = categoryMap.get(item.upc) || null;
        const description = descriptionMap.get(item.upc) || 'Unknown Item';
        
        const daysInStock = lastSold 
          ? Math.floor((Date.now() - new Date(lastSold).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        return {
          upc: item.upc,
          description,
          category,
          cost: item.cost,
          price: item.price,
          quantity: item.quantity,
          value,
          margin,
          turnoverRate,
          daysInStock,
          lastSold
        };
      });
      
      // Calculate metrics
      const totalItems = processedItems.length;
      const totalQuantity = processedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = processedItems.reduce((sum, item) => sum + item.value, 0);
      const totalCost = processedItems.reduce((sum, item) => sum + (item.quantity * item.cost), 0);
      const avgMargin = totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0;
      
      // Stock level analysis
      const lowStockItems = processedItems.filter(item => item.quantity > 0 && item.quantity <= 10).length;
      const overstockItems = processedItems.filter(item => item.quantity >= 100).length;
      const deadStock = processedItems.filter(item => item.daysInStock > 30 && item.quantity > 0).length;
      const fastMovers = processedItems.filter(item => item.turnoverRate > 0.5).length;
      
      // Stock level distribution
      const stockLevels = {
        critical: processedItems.filter(item => item.quantity > 0 && item.quantity <= 5).length,
        low: processedItems.filter(item => item.quantity > 5 && item.quantity <= 10).length,
        normal: processedItems.filter(item => item.quantity > 10 && item.quantity < 50).length,
        high: processedItems.filter(item => item.quantity >= 50 && item.quantity < 100).length,
        excess: processedItems.filter(item => item.quantity >= 100).length
      };
      
      // Category breakdown
      const categoryStatsMap = new Map<string, { items: number; quantity: number; value: number }>();
      
      processedItems.forEach(item => {
        const category = item.category || 'Uncategorized';
        const existing = categoryStatsMap.get(category) || { items: 0, quantity: 0, value: 0 };
        categoryStatsMap.set(category, {
          items: existing.items + 1,
          quantity: existing.quantity + item.quantity,
          value: existing.value + item.value
        });
      });
      
      const categoryBreakdown = Array.from(categoryStatsMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      
      return {
        success: true,
        data: {
          metrics: {
            totalItems,
            totalQuantity,
            totalValue,
            totalCost,
            avgMargin,
            lowStockItems,
            overstockItems,
            deadStock,
            fastMovers,
            categoryBreakdown,
            stockLevels
          },
          items: processedItems
        }
      };
    } catch (error) {
      console.error("Error getting inventory analysis:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get inventory analysis"
      };
    }
  });
}

// Get Weekly/Monthly Summary handler
function registerWeeklySummary(ipcMain: IpcMain) {
  ipcMain.handle("get-weekly-summary", async (_event, date: string, periodType: 'week' | 'month') => {
    try {
      const invDb = getInventoryDb();
      const productsDb = getProductsDb();
      
      // Calculate date range based on period type
      const selectedDate = new Date(date);
      let startDate: Date;
      let endDate: Date;
      let previousStartDate: Date;
      let previousEndDate: Date;
      
      if (periodType === 'week') {
        // Calculate week (Sunday to Saturday)
        const dayOfWeek = selectedDate.getDay();
        startDate = new Date(selectedDate);
        startDate.setDate(selectedDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        
        // Previous week
        previousStartDate = new Date(startDate);
        previousStartDate.setDate(startDate.getDate() - 7);
        previousEndDate = new Date(endDate);
        previousEndDate.setDate(endDate.getDate() - 7);
      } else {
        // Calculate month
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        // Previous month
        previousStartDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
        previousEndDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0, 23, 59, 59, 999);
      }
      
      // Get daily data for the period
      const dailyData = invDb.prepare(`
        SELECT 
          DATE(created_at) as date,
          SUM(total) as sales,
          COUNT(*) as transactions,
          SUM(
            (SELECT SUM(json_extract(value, '$.quantity')) 
             FROM json_each(items))
          ) as items
        FROM transactions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all(
        startDate.toISOString(),
        endDate.toISOString()
      ) as Array<{
        date: string;
        sales: number;
        transactions: number;
        items: number;
      }>;
      
      // Fill in missing days with zeros
      const allDays = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayData = dailyData.find(d => d.date === dateStr);
        allDays.push({
          date: dateStr,
          sales: dayData?.sales || 0,
          transactions: dayData?.transactions || 0,
          items: dayData?.items || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate totals
      const totalSales = allDays.reduce((sum, day) => sum + day.sales, 0);
      const totalTransactions = allDays.reduce((sum, day) => sum + day.transactions, 0);
      const totalItems = allDays.reduce((sum, day) => sum + day.items, 0);
      const avgDailySales = totalSales / allDays.length;
      const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      
      // Find best and worst days
      const sortedDays = [...allDays].sort((a, b) => b.sales - a.sales);
      const bestDay = sortedDays[0] || { date: startDate.toISOString().split('T')[0], sales: 0 };
      const worstDay = sortedDays[sortedDays.length - 1] || { date: startDate.toISOString().split('T')[0], sales: 0 };
      
      // Calculate week/month over week/month change
      const previousPeriodData = invDb.prepare(`
        SELECT 
          SUM(total) as sales,
          COUNT(*) as transactions
        FROM transactions
        WHERE created_at >= ? AND created_at <= ?
      `).get(
        previousStartDate.toISOString(),
        previousEndDate.toISOString()
      ) as { sales: number | null; transactions: number | null };
      
      let weekOverWeek = undefined;
      if (previousPeriodData.sales && previousPeriodData.sales > 0) {
        weekOverWeek = {
          sales: ((totalSales - previousPeriodData.sales) / previousPeriodData.sales) * 100,
          transactions: previousPeriodData.transactions ? 
            ((totalTransactions - previousPeriodData.transactions) / previousPeriodData.transactions) * 100 : 0
        };
      }
      
      // Get top categories using the products database
      let topCategories: Array<{ category: string; sales: number; items: number; }> = [];
      
      if (productsDb) {
        try {
          // Attach products database to inventory database for the query
          invDb.exec(`ATTACH DATABASE '${path.join(__dirname, "..", "LiquorDatabase.db")}' AS products_db`);
          
          topCategories = invDb.prepare(`
            SELECT 
              COALESCE(p.category, 'Uncategorized') as category,
              SUM(json_extract(item.value, '$.quantity') * json_extract(item.value, '$.price')) as sales,
              SUM(json_extract(item.value, '$.quantity')) as items
            FROM transactions t,
                 json_each(t.items) item
            LEFT JOIN products_db.products p ON json_extract(item.value, '$.upc') = p.upc
            WHERE t.created_at >= ? AND t.created_at <= ?
            GROUP BY category
            ORDER BY sales DESC
            LIMIT 5
          `).all(
            startDate.toISOString(),
            endDate.toISOString()
          ) as Array<{
            category: string;
            sales: number;
            items: number;
          }>;
          
          invDb.exec("DETACH DATABASE products_db");
        } catch (err) {
          console.error("Error getting categories:", err);
          // Fallback to uncategorized
          topCategories = invDb.prepare(`
            SELECT 
              'Uncategorized' as category,
              SUM(json_extract(item.value, '$.quantity') * json_extract(item.value, '$.price')) as sales,
              SUM(json_extract(item.value, '$.quantity')) as items
            FROM transactions t,
                 json_each(t.items) item
            WHERE t.created_at >= ? AND t.created_at <= ?
            GROUP BY category
            ORDER BY sales DESC
            LIMIT 1
          `).all(
            startDate.toISOString(),
            endDate.toISOString()
          ) as typeof topCategories;
        }
      }
      
      return {
        success: true,
        data: {
          period: periodType === 'week' ? 'Week' : 'Month',
          totalSales,
          totalTransactions,
          totalItems,
          avgDailySales,
          avgTransactionValue,
          bestDay: {
            date: bestDay.date,
            sales: bestDay.sales
          },
          worstDay: {
            date: worstDay.date,
            sales: worstDay.sales
          },
          dailyData: allDays,
          weekOverWeek,
          topCategories
        }
      };
    } catch (error) {
      console.error("Error getting weekly summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get weekly summary"
      };
    }
  });
}

// User Management Functions
function registerUserManagement(ipcMain: IpcMain) {
  // Check user type for login
  ipcMain.handle("check-user-type", async (_, username: string) => {
    try {
      const storeDb = getStoreInfoDb();
      const user = storeDb.prepare(`
        SELECT role, active 
        FROM users 
        WHERE username = ? AND active = 1
      `).get(username) as any;
      
      if (user) {
        return {
          success: true,
          role: user.role,
          requiresPin: user.role === 'cashier',
          requiresPassword: user.role === 'admin' || user.role === 'manager'
        };
      } else {
        return {
          success: false,
          error: "User not found"
        };
      }
    } catch (error) {
      console.error("Check user type error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check user"
      };
    }
  });

  // User authentication with PIN
  ipcMain.handle("user-login-pin", async (_, username: string, pin: string) => {
    try {
      const storeDb = getStoreInfoDb();
      const user = storeDb.prepare(`
        SELECT id, username, role, full_name, active 
        FROM users 
        WHERE username = ? AND pin = ? AND active = 1
      `).get(username, pin) as any;
      
      if (user) {
        currentUser = { id: user.id, username: user.username, role: user.role };
        
        // Update last login
        storeDb.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
        
        // Log activity
        storeDb.prepare(`
          INSERT INTO user_activity (user_id, action, details) 
          VALUES (?, 'login', 'User logged in with PIN')
        `).run(user.id);
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.full_name
          }
        };
      } else {
        return {
          success: false,
          error: "Invalid PIN"
        };
      }
    } catch (error) {
      console.error("PIN login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed"
      };
    }
  });

  // Login with password
  ipcMain.handle("user-login", async (_, username: string, password: string) => {
    try {
      const storeDb = getStoreInfoDb();
      const user = storeDb.prepare(`
        SELECT id, username, role, full_name, active 
        FROM users 
        WHERE username = ? AND password = ? AND active = 1
      `).get(username, password) as any;
      
      if (user) {
        currentUser = { id: user.id, username: user.username, role: user.role };
        
        // Update last login
        storeDb.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
        
        // Log activity
        storeDb.prepare(`
          INSERT INTO user_activity (user_id, action, details) 
          VALUES (?, 'login', 'User logged in')
        `).run(user.id);
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.full_name
          }
        };
      } else {
        return {
          success: false,
          error: "Invalid username or password"
        };
      }
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed"
      };
    }
  });
  
  // Logout
  ipcMain.handle("user-logout", async () => {
    try {
      if (currentUser) {
        const storeDb = getStoreInfoDb();
        storeDb.prepare(`
          INSERT INTO user_activity (user_id, action, details) 
          VALUES (?, 'logout', 'User logged out')
        `).run(currentUser.id);
      }
      
      currentUser = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: "Logout failed" };
    }
  });
  
  // Get current user
  ipcMain.handle("get-current-user", async () => {
    return {
      success: true,
      user: currentUser
    };
  });
  
  // Get all users (admin only)
  ipcMain.handle("get-users", async () => {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return {
          success: false,
          error: "Unauthorized. Admin access required."
        };
      }
      
      const storeDb = getStoreInfoDb();
      const users = storeDb.prepare(`
        SELECT id, username, role, full_name, active, created_at, last_login 
        FROM users 
        ORDER BY created_at DESC
      `).all();
      
      return {
        success: true,
        users
      };
    } catch (error) {
      console.error("Get users error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get users"
      };
    }
  });
  
  // Add user during initial setup (no auth check)
  ipcMain.handle("add-user-during-setup", async (_, userData: {
    username: string;
    password: string;
    role: string;
    fullName: string;
  }) => {
    try {
      console.log("Adding user during setup:", userData.username);
      const storeDb = getStoreInfoDb();
      
      // Check if this specific username already exists
      const existingUser = storeDb.prepare("SELECT username FROM users WHERE username = ?").get(userData.username);
      if (existingUser) {
        // Get all users for debugging
        const allUsers = storeDb.prepare("SELECT username, role FROM users").all();
        console.error("User already exists. All users:", allUsers);
        return {
          success: false,
          error: `Username '${userData.username}' is already taken. Please choose a different username.`
        };
      }
      
      // During initial setup, we allow creating the first admin
      // Check if this is truly the first user
      const userCount = storeDb.prepare("SELECT COUNT(*) as count FROM users").get() as any;
      if (userCount.count > 0 && userData.role !== 'admin') {
        return {
          success: false,
          error: "Initial setup can only create admin users."
        };
      }
      
      // Insert the user
      const result = storeDb.prepare(`
        INSERT INTO users (username, password, role, full_name) 
        VALUES (?, ?, ?, ?)
      `).run(userData.username, userData.password, userData.role, userData.fullName);
      
      console.log(`Created setup user: ${userData.username} (${userData.role})`);
      
      return {
        success: true,
        userId: result.lastInsertRowid
      };
    } catch (error) {
      console.error("Add setup user error:", error);
      
      // Check if it's a unique constraint error
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        return {
          success: false,
          error: `Username '${userData.username}' is already taken.`
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create admin user"
      };
    }
  });
  
  // Add user (admin only)
  ipcMain.handle("add-user", async (_, userData: {
    username: string;
    password?: string;
    pin?: string;
    role: string;
    fullName: string;
  }) => {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return {
          success: false,
          error: "Unauthorized. Admin access required."
        };
      }
      
      const storeDb = getStoreInfoDb();
      
      // Check if username already exists
      const existing = storeDb.prepare("SELECT id FROM users WHERE username = ?").get(userData.username);
      if (existing) {
        return {
          success: false,
          error: "Username already exists"
        };
      }
      
      // Validate PIN for cashiers
      if (userData.role === 'cashier') {
        if (!userData.pin || userData.pin.length !== 4 || !/^\d{4}$/.test(userData.pin)) {
          return {
            success: false,
            error: "Cashiers must have a 4-digit PIN"
          };
        }
      }
      
      // Validate password for admin/manager
      if ((userData.role === 'admin' || userData.role === 'manager') && !userData.password) {
        return {
          success: false,
          error: "Admin and manager accounts require a password"
        };
      }
      
      // Insert new user
      const result = storeDb.prepare(`
        INSERT INTO users (username, password, pin, role, full_name, created_by) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userData.username, 
        userData.password || null, 
        userData.pin || null, 
        userData.role, 
        userData.fullName, 
        currentUser.id
      );
      
      // Log activity
      storeDb.prepare(`
        INSERT INTO user_activity (user_id, action, details) 
        VALUES (?, 'create_user', ?)
      `).run(currentUser.id, `Created user: ${userData.username}`);
      
      return {
        success: true,
        userId: result.lastInsertRowid
      };
    } catch (error) {
      console.error("Add user error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add user"
      };
    }
  });
  
  // Remove user (admin only, cannot remove self or last admin)
  ipcMain.handle("remove-user", async (_, userId: number) => {
    try {
      if (!currentUser || currentUser.role !== 'admin') {
        return {
          success: false,
          error: "Unauthorized. Admin access required."
        };
      }
      
      if (userId === currentUser.id) {
        return {
          success: false,
          error: "Cannot remove your own account"
        };
      }
      
      const storeDb = getStoreInfoDb();
      
      // Check if this is the last admin
      const user = storeDb.prepare("SELECT username, role FROM users WHERE id = ?").get(userId) as any;
      if (user && user.role === 'admin') {
        const adminCount = storeDb.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND active = 1").get() as any;
        if (adminCount.count <= 1) {
          return {
            success: false,
            error: "Cannot remove the last admin user"
          };
        }
      }
      
      // Soft delete (deactivate) the user
      storeDb.prepare("UPDATE users SET active = 0 WHERE id = ?").run(userId);
      
      // Log activity
      storeDb.prepare(`
        INSERT INTO user_activity (user_id, action, details) 
        VALUES (?, 'remove_user', ?)
      `).run(currentUser.id, `Removed user: ${user.username}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error("Remove user error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove user"
      };
    }
  });
  
  // Get user activity
  ipcMain.handle("get-user-activity", async (_, userId?: number) => {
    try {
      if (!currentUser) {
        return {
          success: false,
          error: "Not logged in"
        };
      }
      
      const storeDb = getStoreInfoDb();
      let query = `
        SELECT 
          ua.id,
          ua.user_id,
          u.username,
          u.full_name,
          ua.action,
          ua.details,
          ua.timestamp
        FROM user_activity ua
        JOIN users u ON ua.user_id = u.id
      `;
      
      const params = [];
      if (userId) {
        query += " WHERE ua.user_id = ?";
        params.push(userId);
      }
      
      query += " ORDER BY ua.timestamp DESC LIMIT 100";
      
      const activities = storeDb.prepare(query).all(...params);
      
      return {
        success: true,
        activities
      };
    } catch (error) {
      console.error("Get activity error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get activity"
      };
    }
  });

  // Save transaction with custom date (for YTD test data)
  ipcMain.handle("save-transaction-with-date", async (_, transaction: Transaction & { customDate: string }) => {
  try {
    const invDb = getInventoryDb();
    
    // Start a transaction for data consistency
    invDb.prepare("BEGIN TRANSACTION").run();
    
    try {
      // Parse the items to deduct from inventory
      const items = JSON.parse(transaction.items);
      
      // Save the transaction with custom date
      const stmt = invDb.prepare(`
        INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given, created_at, created_by_user_id, created_by_username)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        transaction.items,
        transaction.subtotal,
        transaction.tax,
        transaction.total,
        transaction.payment_type,
        transaction.cash_given || null,
        transaction.change_given || null,
        transaction.customDate,
        currentUser?.id || null,
        currentUser?.username || 'ytd-test'
      );
      
      const transactionId = result.lastInsertRowid;
      
      // Deduct items from inventory and record adjustments
      for (const item of items) {
        // Skip inventory checks for special items that don't track inventory
        const specialPrefixes = ['PAYOUT_', 'LOTTERY-', 'MISC-TAX-', 'MISC-NONTAX-'];
        const isSpecialItem = specialPrefixes.some(prefix => item.upc.startsWith(prefix));
        
        // Skip inventory checks for payout/credit items or special items
        if (item.price < 0 || isSpecialItem) {
          continue; // These don't affect inventory
        }
        
        // Update inventory quantity
        const updateStmt = invDb.prepare(`
          UPDATE inventory 
          SET quantity = quantity - ?,
              updated_at = ?
          WHERE upc = ?
        `);
        updateStmt.run(item.quantity, transaction.customDate, item.upc);
        
        // Get updated quantity for adjustment record
        const currentInv = invDb.prepare("SELECT quantity FROM inventory WHERE upc = ?").get(item.upc) as { quantity: number };
        
        // Record inventory adjustment
        const adjustmentStmt = invDb.prepare(`
          INSERT INTO inventory_adjustments (
            upc, adjustment_type, quantity_change, quantity_before, quantity_after,
            cost, price, reference_id, reference_type, notes, created_at, created_by_user_id, created_by_username
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        adjustmentStmt.run(
          item.upc,
          'sale',
          -item.quantity,
          currentInv.quantity + item.quantity,
          currentInv.quantity,
          item.cost || 0,
          item.price || 0,
          transactionId,
          'transaction',
          `Sale transaction #${transactionId}`,
          transaction.customDate,
          currentUser?.id || null,
          currentUser?.username || 'ytd-test'
        );
      }
      
      invDb.prepare("COMMIT").run();
      
      return {
        success: true,
        transactionId: Number(transactionId),
        message: "Transaction saved successfully"
      };
    } catch (error) {
      invDb.prepare("ROLLBACK").run();
      throw error;
    }
  } catch (error) {
    console.error("Save transaction with date error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save transaction"
    };
  }
});

// Add to inventory with custom date (for YTD test data)
ipcMain.handle("add-to-inventory-with-date", async (_, item: InventoryItem & { customDate: string }) => {
  try {
    const invDb = getInventoryDb();
    
    // Start transaction for data consistency
    invDb.prepare("BEGIN TRANSACTION").run();
    
    try {
      // Check if already exists in inventory
      const existing = invDb.prepare(`
        SELECT * FROM inventory WHERE upc = ?
      `).get(item.upc) as InventoryItem & { quantity: number } | undefined;
      
      const quantityBefore = existing ? existing.quantity : 0;
      const quantityAfter = quantityBefore + item.quantity;
      
      if (existing) {
        // Update existing record
        const stmt = invDb.prepare(`
          UPDATE inventory 
          SET quantity = quantity + ?, 
              cost = ?, 
              price = ?,
              updated_at = ?
          WHERE upc = ?
        `);
        stmt.run(item.quantity, item.cost, item.price, item.customDate, item.upc);
      } else {
        // Insert new record with custom date
        const stmt = invDb.prepare(`
          INSERT INTO inventory (upc, cost, price, quantity, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(item.upc, item.cost, item.price, item.quantity, item.customDate, item.customDate);
      }
      
      // Record the adjustment with custom date
      const adjustmentStmt = invDb.prepare(`
        INSERT INTO inventory_adjustments (
          upc, adjustment_type, quantity_change, quantity_before, quantity_after,
          cost, price, reference_type, notes, created_at, created_by_user_id, created_by_username
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      adjustmentStmt.run(
        item.upc,
        'purchase',
        item.quantity,
        quantityBefore,
        quantityAfter,
        item.cost,
        item.price,
        'test_data',
        'YTD test inventory restock',
        item.customDate,
        currentUser?.id || null,
        currentUser?.username || 'ytd-test'
      );
      
      invDb.prepare("COMMIT").run();
      
      return {
        success: true,
        message: `Inventory updated! Added ${item.quantity} units.`,
        updated: !!existing
      };
    } catch (error) {
      invDb.prepare("ROLLBACK").run();
      throw error;
    }
  } catch (error) {
    console.error("Add to inventory with date error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add to inventory"
    };
  }
  });
  
  // Get random products for mock data generation
  ipcMain.handle("get-random-products", async (_, count: number = 100) => {
    try {
      const prodDb = getProductsDb();
      
      // Get random products from the database using correct column names
      const products = prodDb.prepare(`
        SELECT 
          "UPC" as upc,
          "Item Description" as description,
          "Bottle Volume (ml)" as volume,
          "State Bottle Cost" as wac,
          "State Bottle Retail" as retail,
          "Category Name" as category,
          "Vendor Name" as subcategory
        FROM products 
        WHERE "UPC" IS NOT NULL 
          AND "Item Description" IS NOT NULL
          AND "State Bottle Cost" > 0
          AND "State Bottle Retail" > 0
        ORDER BY RANDOM() 
        LIMIT ?
      `).all(count);
      
      return {
        success: true,
        products
      };
    } catch (error) {
      console.error("Get random products error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get random products"
      };
    }
  });
  
  // Clear mock data (transactions and inventory)
  ipcMain.handle("clear-mock-data", async () => {
    try {
      const invDb = getInventoryDb();
      
      // Clear all transactions
      invDb.prepare("DELETE FROM transactions").run();
      
      // Clear all inventory
      invDb.prepare("DELETE FROM inventory").run();
      
      // Clear inventory adjustments
      invDb.prepare("DELETE FROM inventory_adjustments").run();
      
      return {
        success: true,
        message: "Mock data cleared successfully"
      };
    } catch (error) {
      console.error("Clear mock data error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear mock data"
      };
    }
  });
  
  // Save mock transaction
  ipcMain.handle("save-mock-transaction", async (_, transaction: any) => {
    try {
      const invDb = getInventoryDb();
      
      // Begin transaction
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        // Calculate tax properly
        const subtotal = transaction.total;
        const tax = subtotal * 0.06; // 6% tax
        const total = subtotal + tax;
        
        // Insert the transaction using correct column names
        const insertTransaction = invDb.prepare(`
          INSERT INTO transactions (
            created_at,
            items,
            subtotal,
            tax,
            total,
            payment_type,
            created_by_user_id,
            created_by_username
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = insertTransaction.run(
          transaction.timestamp,
          JSON.stringify(transaction.items),
          subtotal,
          tax,
          total,
          transaction.payment_method || 'cash',
          null,  // No specific user ID for mock data
          'mock_generator'
        );
        
        // Update inventory for each item
        for (const item of transaction.items) {
          const updateInventory = invDb.prepare(`
            UPDATE inventory 
            SET quantity = quantity - ?
            WHERE upc = ?
          `);
          
          updateInventory.run(item.quantity, item.upc);
        }
        
        invDb.prepare("COMMIT").run();
        
        return {
          success: true,
          transactionId: result.lastInsertRowid
        };
      } catch (error) {
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Save mock transaction error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save mock transaction"
      };
    }
  });
  
  // Till Management IPC Handlers
  // Get till settings
  ipcMain.handle("get-till-settings", async () => {
    try {
      const invDb = getInventoryDb();
      
      // Get or create default settings
      let settings = invDb.prepare(`
        SELECT * FROM till_settings ORDER BY id DESC LIMIT 1
      `).get() as any;
      
      if (!settings) {
        // Create default settings
        invDb.prepare(`
          INSERT INTO till_settings (enabled, ones, fives, tens, twenties, fifties, hundreds)
          VALUES (0, 0, 0, 0, 0, 0, 0)
        `).run();
        
        settings = invDb.prepare(`
          SELECT * FROM till_settings ORDER BY id DESC LIMIT 1
        `).get();
      }
      
      return {
        success: true,
        data: {
          enabled: settings.enabled === 1,
          denominations: {
            ones: settings.ones,
            fives: settings.fives,
            tens: settings.tens,
            twenties: settings.twenties,
            fifties: settings.fifties,
            hundreds: settings.hundreds
          }
        }
      };
    } catch (error) {
      console.error("Get till settings error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get till settings"
      };
    }
  });

  // Save till settings
  ipcMain.handle("save-till-settings", async (_, settings: any) => {
    try {
      const invDb = getInventoryDb();
      
      // Update or insert settings
      const existing = invDb.prepare(`
        SELECT id FROM till_settings ORDER BY id DESC LIMIT 1
      `).get() as any;
      
      if (existing) {
        invDb.prepare(`
          UPDATE till_settings
          SET enabled = ?, ones = ?, fives = ?, tens = ?, twenties = ?, fifties = ?, hundreds = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          settings.enabled ? 1 : 0,
          settings.denominations.ones,
          settings.denominations.fives,
          settings.denominations.tens,
          settings.denominations.twenties,
          settings.denominations.fifties,
          settings.denominations.hundreds,
          existing.id
        );
      } else {
        invDb.prepare(`
          INSERT INTO till_settings (enabled, ones, fives, tens, twenties, fifties, hundreds)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          settings.enabled ? 1 : 0,
          settings.denominations.ones,
          settings.denominations.fives,
          settings.denominations.tens,
          settings.denominations.twenties,
          settings.denominations.fifties,
          settings.denominations.hundreds
        );
      }
      
      return { success: true };
    } catch (error) {
      console.error("Save till settings error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save till settings"
      };
    }
  });

  // Get current till status
  ipcMain.handle("get-current-till", async () => {
    try {
      const invDb = getInventoryDb();
      const today = new Date().toISOString().split('T')[0];
      
      // First check if there's ANY till record for today
      let till = invDb.prepare(`
        SELECT * FROM daily_till WHERE date = ?
      `).get(today) as any;
      
      if (till) {
        // If till exists but status is NULL or closed, update it to open if settings are enabled
        if (till.status !== 'open') {
          const settings = invDb.prepare(`
            SELECT * FROM till_settings ORDER BY id DESC LIMIT 1
          `).get() as any;
          
          if (settings && settings.enabled === 1) {
            // Reopen the till with current values
            invDb.prepare(`
              UPDATE daily_till 
              SET status = 'open', closed_at = NULL
              WHERE date = ?
            `).run(today);
            
            till = invDb.prepare(`
              SELECT * FROM daily_till WHERE date = ?
            `).get(today) as any;
          } else {
            // Till exists but is closed and settings are not enabled
            return { success: true, data: null };
          }
        }
        
        return {
          success: true,
          data: formatTillData(till)
        };
      }
      
      // No till exists for today, check if we should create one
      const settings = invDb.prepare(`
        SELECT * FROM till_settings ORDER BY id DESC LIMIT 1
      `).get() as any;
      
      if (settings && settings.enabled === 1) {
        // Auto-initialize till for today
        try {
          invDb.prepare(`
            INSERT INTO daily_till (
              date, 
              starting_ones, starting_fives, starting_tens, starting_twenties, starting_fifties, starting_hundreds,
              current_ones, current_fives, current_tens, current_twenties, current_fifties, current_hundreds,
              status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
          `).run(
            today,
            settings.ones, settings.fives, settings.tens, settings.twenties, settings.fifties, settings.hundreds,
            settings.ones, settings.fives, settings.tens, settings.twenties, settings.fifties, settings.hundreds
          );
          
          const newTill = invDb.prepare(`
            SELECT * FROM daily_till WHERE date = ?
          `).get(today) as any;
          
          return {
            success: true,
            data: formatTillData(newTill)
          };
        } catch (insertError) {
          console.error("Error inserting new till:", insertError);
          return { success: true, data: null };
        }
      }
      
      return { success: true, data: null };
    } catch (error) {
      console.error("Get current till error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get current till"
      };
    }
  });

  // Initialize till for today
  ipcMain.handle("initialize-till", async (_, denominations: any) => {
    try {
      const invDb = getInventoryDb();
      const today = new Date().toISOString().split('T')[0];
      
      // Check if till already exists for today
      const existing = invDb.prepare(`
        SELECT id FROM daily_till WHERE date = ?
      `).get(today) as any;
      
      if (existing) {
        return {
          success: false,
          error: "Till already initialized for today"
        };
      }
      
      invDb.prepare(`
        INSERT INTO daily_till (
          date, 
          starting_ones, starting_fives, starting_tens, starting_twenties, starting_fifties, starting_hundreds,
          current_ones, current_fives, current_tens, current_twenties, current_fifties, current_hundreds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        today,
        denominations.ones, denominations.fives, denominations.tens, 
        denominations.twenties, denominations.fifties, denominations.hundreds,
        denominations.ones, denominations.fives, denominations.tens, 
        denominations.twenties, denominations.fifties, denominations.hundreds
      );
      
      const newTill = invDb.prepare(`
        SELECT * FROM daily_till WHERE date = ?
      `).get(today) as any;
      
      return {
        success: true,
        data: formatTillData(newTill)
      };
    } catch (error) {
      console.error("Initialize till error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize till"
      };
    }
  });

  // Close till for the day
  ipcMain.handle("close-till", async () => {
    try {
      const invDb = getInventoryDb();
      const today = new Date().toISOString().split('T')[0];
      
      invDb.prepare(`
        UPDATE daily_till 
        SET status = 'closed', closed_at = CURRENT_TIMESTAMP
        WHERE date = ? AND status = 'open'
      `).run(today);
      
      return { success: true };
    } catch (error) {
      console.error("Close till error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to close till"
      };
    }
  });

  // Reset till (for testing)
  ipcMain.handle("reset-till", async () => {
    try {
      const invDb = getInventoryDb();
      const today = new Date().toISOString().split('T')[0];
      
      // Delete today's till record
      invDb.prepare(`
        DELETE FROM daily_till WHERE date = ?
      `).run(today);
      
      // Get till settings to reinitialize if enabled
      const settings = invDb.prepare(`
        SELECT * FROM till_settings ORDER BY id DESC LIMIT 1
      `).get() as any;
      
      let newTillData = null;
      
      if (settings && settings.enabled === 1) {
        // Reinitialize with default settings
        invDb.prepare(`
          INSERT INTO daily_till (
            date, 
            starting_ones, starting_fives, starting_tens, starting_twenties, starting_fifties, starting_hundreds,
            current_ones, current_fives, current_tens, current_twenties, current_fifties, current_hundreds,
            cash_in, cash_out
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `).run(
          today,
          settings.ones, settings.fives, settings.tens, settings.twenties, settings.fifties, settings.hundreds,
          settings.ones, settings.fives, settings.tens, settings.twenties, settings.fifties, settings.hundreds
        );
        
        const newTill = invDb.prepare(`
          SELECT * FROM daily_till WHERE date = ?
        `).get(today) as any;
        
        newTillData = formatTillData(newTill);
      }
      
      return {
        success: true,
        data: newTillData,
        message: "Till has been reset successfully"
      };
    } catch (error) {
      console.error("Reset till error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset till"
      };
    }
  });

  // Update till after cash transaction
  ipcMain.handle("update-till-cash", async (_, amount: number, isReturn = false) => {
    try {
      // Use the helper function
      await updateTillForCashTransaction(amount, isReturn);
      return { success: true };
    } catch (error) {
      console.error("Update till cash error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update till"
      };
    }
  });
}

// Helper function to update till for cash transactions
async function updateTillForCashTransaction(amount: number, isReturn: boolean) {
  try {
    const invDb = getInventoryDb();
    const today = new Date().toISOString().split('T')[0];
    
    // Get current till
    const till = invDb.prepare(`
      SELECT * FROM daily_till WHERE date = ? AND status = 'open'
    `).get(today) as any;
    
    if (!till) {
      // Till not initialized, skip update
      return;
    }
    
    // Round amount to nearest dollar
    const roundedAmount = Math.round(amount);
    const cashDelta = isReturn ? -Math.abs(roundedAmount) : Math.abs(roundedAmount);
    
    // Calculate denomination changes (simplified - uses common bills)
    let remainingAmount = Math.abs(roundedAmount);
    let hundredsDelta = 0;
    let fiftiesDelta = 0;
    let twentiesDelta = 0;
    let tensDelta = 0;
    let fivesDelta = 0;
    let onesDelta = 0;
    
    // For simplicity, we'll primarily use twenties and adjust with smaller bills
    twentiesDelta = Math.floor(remainingAmount / 20);
    remainingAmount = remainingAmount % 20;
    
    if (remainingAmount >= 10) {
      tensDelta = 1;
      remainingAmount -= 10;
    }
    
    if (remainingAmount >= 5) {
      fivesDelta = 1;
      remainingAmount -= 5;
    }
    
    onesDelta = remainingAmount;
    
    // Apply sign based on transaction type
    const sign = cashDelta > 0 ? 1 : -1;
    
    // Update cash in/out tracking
    const cashInUpdate = isReturn ? 0 : roundedAmount;
    const cashOutUpdate = isReturn ? roundedAmount : 0;
    
    invDb.prepare(`
      UPDATE daily_till 
      SET 
        current_ones = current_ones + ?,
        current_fives = current_fives + ?,
        current_tens = current_tens + ?,
        current_twenties = current_twenties + ?,
        current_fifties = current_fifties + ?,
        current_hundreds = current_hundreds + ?,
        cash_transactions = cash_transactions + ?,
        cash_in = cash_in + ?,
        cash_out = cash_out + ?
      WHERE date = ? AND status = 'open'
    `).run(
      onesDelta * sign,
      fivesDelta * sign,
      tensDelta * sign,
      twentiesDelta * sign,
      fiftiesDelta * sign,
      hundredsDelta * sign,
      isReturn ? 0 : 1, // Only count non-return transactions
      cashInUpdate,
      cashOutUpdate,
      today
    );
  } catch (error) {
    console.error("Update till for cash transaction error:", error);
    // Don't throw - till updates shouldn't break transactions
  }
}

// Helper function to format till data
function formatTillData(till: any) {
  if (!till) return null;
  
  const startingCash = 
    till.starting_ones * 1 +
    till.starting_fives * 5 +
    till.starting_tens * 10 +
    till.starting_twenties * 20 +
    till.starting_fifties * 50 +
    till.starting_hundreds * 100;
  
  const currentCash = 
    till.current_ones * 1 +
    till.current_fives * 5 +
    till.current_tens * 10 +
    till.current_twenties * 20 +
    till.current_fifties * 50 +
    till.current_hundreds * 100;
  
  return {
    date: till.date,
    startingCash,
    currentCash,
    transactions: till.cash_transactions,
    cashIn: till.cash_in || 0,
    cashOut: till.cash_out || 0,
    denominations: {
      ones: till.current_ones,
      fives: till.current_fives,
      tens: till.current_tens,
      twenties: till.current_twenties,
      fifties: till.current_fifties,
      hundreds: till.current_hundreds
    }
  };
}

// Time Clock Management Functions
function registerTimeClock(ipcMain: IpcMain) {
  // Get current shift for a user
  ipcMain.handle("get-current-shift", async (_, userId: number) => {
    try {
      const storeDb = getStoreInfoDb();
      // const today = new Date().toISOString().split('T')[0];
      
      // Get the current active shift (punch_out is null)
      const shift = storeDb.prepare(`
        SELECT * FROM time_clock 
        WHERE user_id = ? AND punch_out IS NULL
        ORDER BY punch_in DESC
        LIMIT 1
      `).get(userId) as any;
      
      return {
        success: true,
        data: shift || null
      };
    } catch (error) {
      console.error("Get current shift error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get current shift"
      };
    }
  });

  // Punch in
  ipcMain.handle("punch-in", async (_, userId: number) => {
    try {
      const storeDb = getStoreInfoDb();
      
      // Check if already punched in
      const activeShift = storeDb.prepare(`
        SELECT id FROM time_clock 
        WHERE user_id = ? AND punch_out IS NULL
      `).get(userId) as any;
      
      if (activeShift) {
        return {
          success: false,
          error: "Already punched in. Please punch out first."
        };
      }
      
      const now = new Date();
      const shiftDate = now.toISOString().split('T')[0];
      
      const result = storeDb.prepare(`
        INSERT INTO time_clock (user_id, punch_in, shift_date)
        VALUES (?, ?, ?)
      `).run(userId, now.toISOString(), shiftDate);
      
      // Log activity
      storeDb.prepare(`
        INSERT INTO user_activity (user_id, action, details)
        VALUES (?, 'punch_in', 'Punched in for shift')
      `).run(userId);
      
      return {
        success: true,
        shiftId: result.lastInsertRowid
      };
    } catch (error) {
      console.error("Punch in error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to punch in"
      };
    }
  });

  // Punch out
  ipcMain.handle("punch-out", async (_, userId: number) => {
    try {
      const storeDb = getStoreInfoDb();
      
      // Get active shift
      const activeShift = storeDb.prepare(`
        SELECT id, punch_in FROM time_clock 
        WHERE user_id = ? AND punch_out IS NULL
        ORDER BY punch_in DESC
        LIMIT 1
      `).get(userId) as any;
      
      if (!activeShift) {
        return {
          success: false,
          error: "No active shift found. Please punch in first."
        };
      }
      
      const now = new Date();
      const punchIn = new Date(activeShift.punch_in);
      const durationMinutes = Math.round((now.getTime() - punchIn.getTime()) / (1000 * 60));
      
      // Update the shift record
      storeDb.prepare(`
        UPDATE time_clock 
        SET punch_out = ?, duration_minutes = ?
        WHERE id = ?
      `).run(now.toISOString(), durationMinutes, activeShift.id);
      
      // Log activity
      storeDb.prepare(`
        INSERT INTO user_activity (user_id, action, details)
        VALUES (?, 'punch_out', ?)
      `).run(userId, `Punched out after ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`);
      
      return {
        success: true,
        duration: durationMinutes
      };
    } catch (error) {
      console.error("Punch out error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to punch out"
      };
    }
  });

  // Get time clock entries with filters
  ipcMain.handle("get-time-clock-entries", async (_, filters?: {
    userId?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      const storeDb = getStoreInfoDb();
      
      let query = `
        SELECT 
          tc.*,
          u.username,
          u.full_name
        FROM time_clock tc
        JOIN users u ON tc.user_id = u.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (filters?.userId) {
        query += ` AND tc.user_id = ?`;
        params.push(filters.userId);
      }
      
      if (filters?.startDate) {
        query += ` AND tc.shift_date >= ?`;
        params.push(filters.startDate);
      }
      
      if (filters?.endDate) {
        query += ` AND tc.shift_date <= ?`;
        params.push(filters.endDate);
      }
      
      query += ` ORDER BY tc.punch_in DESC`;
      
      const entries = storeDb.prepare(query).all(...params);
      
      return {
        success: true,
        data: entries
      };
    } catch (error) {
      console.error("Get time clock entries error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get time clock entries"
      };
    }
  });

  // Clear inventory data
  ipcMain.handle("clear-inventory", async () => {
    try {
      const inventoryDb = getInventoryDb();
      
      // Clear inventory and adjustments
      inventoryDb.exec(`
        DELETE FROM inventory;
        DELETE FROM inventory_adjustments;
      `);
      
      return {
        success: true,
        message: "Inventory data cleared successfully"
      };
    } catch (error) {
      console.error("Clear inventory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear inventory"
      };
    }
  });

  // Clear transactions
  ipcMain.handle("clear-transactions", async () => {
    try {
      const inventoryDb = getInventoryDb();
      
      // Clear only transactions
      inventoryDb.exec(`
        DELETE FROM transactions;
      `);
      
      return {
        success: true,
        message: "Transaction data cleared successfully"
      };
    } catch (error) {
      console.error("Clear transactions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear transactions"
      };
    }
  });

  // Clear ALL data (complete reset - DELETES StoreInformation.db)
  ipcMain.handle("clear-all-data", async () => {
    try {
      console.log("Clearing all data - will delete StoreInformation.db");
      
      // First, close the store info database connection
      if (storeInfoDb) {
        storeInfoDb.close();
        storeInfoDb = null;
        console.log("Closed store info database connection");
      }
      
      // Delete StoreInformation.db completely
      try {
        if (fs.existsSync(storeInfoDbPath)) {
          fs.unlinkSync(storeInfoDbPath);
          console.log("Deleted StoreInformation.db successfully");
        }
        
        // Also delete any journal files
        const journalFiles = [
          storeInfoDbPath + '-journal',
          storeInfoDbPath + '-wal', 
          storeInfoDbPath + '-shm'
        ];
        
        journalFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Deleted ${path.basename(file)}`);
          }
        });
      } catch (deleteError) {
        console.error("Error deleting StoreInformation.db:", deleteError);
      }
      
      // Clear all inventory-related tables
      const inventoryDb = getInventoryDb();
      inventoryDb.exec(`
        DELETE FROM inventory;
        DELETE FROM inventory_adjustments;
        DELETE FROM transactions;
        DELETE FROM daily_till;
        UPDATE till_settings SET 
          enabled = 0,
          ones = 0,
          fives = 0,
          tens = 0,
          twenties = 0,
          fifties = 0,
          hundreds = 0;
      `);
      
      // Clear current user session
      currentUser = null;
      
      return {
        success: true,
        message: "All data cleared successfully! Store information has been completely deleted.\nThe application will restart to complete the reset."
      };
    } catch (error) {
      console.error("Clear all data error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear all data"
      };
    }
  });

  // Clear EVERYTHING including store info and users (factory reset)
  ipcMain.handle("factory-reset", async () => {
    try {
      console.log("Starting complete factory reset...");
      
      // Close store info database connection first
      if (storeInfoDb) {
        storeInfoDb.close();
        storeInfoDb = null;
        console.log("Closed store info database connection");
      }
      
      // Delete StoreInformation.db completely
      try {
        if (fs.existsSync(storeInfoDbPath)) {
          fs.unlinkSync(storeInfoDbPath);
          console.log("Deleted StoreInformation.db successfully");
        }
        
        // Also delete any journal files
        const journalFiles = [
          storeInfoDbPath + '-journal',
          storeInfoDbPath + '-wal', 
          storeInfoDbPath + '-shm'
        ];
        
        journalFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Deleted ${path.basename(file)}`);
          }
        });
      } catch (deleteError) {
        console.error("Error deleting StoreInformation.db:", deleteError);
      }
      
      // Clear inventory database too
      const inventoryDatabase = getInventoryDb();
      
      // Just clear all data from inventory tables, don't drop/recreate
      console.log("Clearing all inventory data...");
      inventoryDatabase.exec(`
        DELETE FROM inventory;
        DELETE FROM transactions;
        DELETE FROM inventory_adjustments;
        DELETE FROM daily_till;
        DELETE FROM payouts;
        DELETE FROM employee_time_clock;
        UPDATE till_settings SET 
          enabled = 0,
          ones = 0,
          fives = 0,
          tens = 0,
          twenties = 0,
          fifties = 0,
          hundreds = 0;
      `);
      
      console.log("Inventory data cleared");
      
      // Clear current user session
      currentUser = null;
      
      // Close and nullify inventory connection to force recreation
      if (inventoryDb) {
        inventoryDb.close();
        inventoryDb = null;
      }
      
      // StoreInfoDb was already closed and nullified before deletion
      
      console.log("Factory reset completed successfully");
      
      return {
        success: true,
        message: "Factory reset complete! All data has been permanently deleted.\nThe application will restart to complete the reset."
      };
    } catch (error) {
      console.error("Factory reset error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to perform factory reset"
      };
    }
  });
}

// Cleanup on app quit
process.on("exit", () => {
  if (productsDb) {
    productsDb.close();
    console.log("Closed products database");
  }
  if (inventoryDb) {
    inventoryDb.close();
    console.log("Closed inventory database");
  }
  if (storeInfoDb) {
    storeInfoDb.close();
    console.log("Closed store info database");
  }
});