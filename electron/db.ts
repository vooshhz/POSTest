// REPLACE THE ENTIRE electron/db.ts file with this:

import { IpcMain } from "electron";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import Papa from "papaparse";

// Separate database connections
const productsDbPath = path.join(process.cwd(), "LiquorDatabase.db");
const inventoryDbPath = path.join(process.cwd(), "LiquorInventory.db");
const storeInfoDbPath = path.join(process.cwd(), "StoreInformation.db");

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
        password TEXT NOT NULL,
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
      
      CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity(timestamp);
    `);
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
      
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_adjustments_upc ON inventory_adjustments(upc);
      CREATE INDEX IF NOT EXISTS idx_adjustments_date ON inventory_adjustments(created_at);
      CREATE INDEX IF NOT EXISTS idx_adjustments_type ON inventory_adjustments(adjustment_type);
    `);
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

  // Save store info
  ipcMain.handle("save-store-info", async (_, storeInfo) => {
    try {
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
        
        // Record the adjustment
        const adjustmentStmt = invDb.prepare(`
          INSERT INTO inventory_adjustments (
            upc, adjustment_type, quantity_change, quantity_before, quantity_after,
            cost, price, reference_type, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          'Manual inventory addition'
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
        
        // Save the transaction first to get the ID
        const stmt = invDb.prepare(`
          INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
          transaction.items,
          transaction.subtotal,
          transaction.tax,
          transaction.total,
          transaction.payment_type,
          transaction.cash_given || null,
          transaction.change_given || null
        );
        
        const transactionId = result.lastInsertRowid;
        
        // Deduct each item from inventory and record adjustments
        for (const item of items) {
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
          
          // Record the adjustment for this sale
          const adjustmentStmt = invDb.prepare(`
            INSERT INTO inventory_adjustments (
              upc, adjustment_type, quantity_change, quantity_before, quantity_after,
              cost, price, reference_id, reference_type, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            `Sale - Transaction #${transactionId}`
          );
        }
        
        // Commit the transaction
        invDb.prepare("COMMIT").run();
        
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
      
      // Get top 10 products by revenue
      const topProducts = Object.entries(productSales)
        .map(([upc, data]) => ({ upc, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
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
  registerClearInventory(ipcMain);
  registerGenerateTestSales(ipcMain);
  registerClearTransactions(ipcMain);
  registerClearAllData(ipcMain);
  registerWeeklySummary(ipcMain);
  registerInventoryAnalysis(ipcMain);
  registerUserManagement(ipcMain);
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
            cost, price, reference_type, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          
          // Record adjustment
          adjustmentStmt.run(
            product.upc,
            'test_data',
            quantity,
            quantityBefore,
            quantityBefore + quantity,
            finalCost,
            finalPrice,
            'test',
            `Test data generation - ${product.description || 'Unknown'}`
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

// Clear all inventory for testing
function registerClearInventory(ipcMain: IpcMain) {
  ipcMain.handle("clear-inventory", async () => {
    try {
      // Initialize database if needed
      const invDb = getInventoryDb();

      // Delete all inventory records
      invDb.prepare("DELETE FROM inventory").run();

      return {
        success: true
      };
    } catch (error) {
      console.error("Error clearing inventory:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear inventory"
      };
    }
  });
}

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
            INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const result = stmt.run(
            transaction.items,
            transaction.subtotal,
            transaction.tax,
            transaction.total,
            transaction.payment_type,
            transaction.cash_given,
            transaction.change_given,
            sale.saleDate.toISOString()
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
            
            // Record adjustment with same date as transaction
            invDb.prepare(`
              INSERT INTO inventory_adjustments (
                upc, adjustment_type, quantity_change, quantity_before, quantity_after,
                cost, price, reference_id, reference_type, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              sale.saleDate.toISOString()
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

// Clear all transactions for testing
function registerClearTransactions(ipcMain: IpcMain) {
  ipcMain.handle("clear-transactions", async () => {
    try {
      const invDb = getInventoryDb();
      
      // Delete all transactions and related adjustments
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        // Delete all transactions
        invDb.prepare("DELETE FROM transactions").run();
        
        // Delete sales-related adjustments
        invDb.prepare("DELETE FROM inventory_adjustments WHERE adjustment_type = 'sale'").run();
        
        invDb.prepare("COMMIT").run();
        
        return {
          success: true
        };
      } catch (error) {
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Error clearing transactions:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear transactions"
      };
    }
  });
}

// Clear ALL data - complete database reset
function registerClearAllData(ipcMain: IpcMain) {
  ipcMain.handle("clear-all-data", async () => {
    try {
      const invDb = getInventoryDb();
      
      // Delete everything in a transaction
      invDb.prepare("BEGIN TRANSACTION").run();
      
      try {
        // Get counts before deletion for reporting
        const transCount = invDb.prepare("SELECT COUNT(*) as count FROM transactions").get() as { count: number };
        const invCount = invDb.prepare("SELECT COUNT(*) as count FROM inventory").get() as { count: number };
        const adjCount = invDb.prepare("SELECT COUNT(*) as count FROM inventory_adjustments").get() as { count: number };
        
        // Delete all data
        invDb.prepare("DELETE FROM transactions").run();
        invDb.prepare("DELETE FROM inventory").run();
        invDb.prepare("DELETE FROM inventory_adjustments").run();
        
        // Reset autoincrement counters
        invDb.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'inventory', 'inventory_adjustments')").run();
        
        invDb.prepare("COMMIT").run();
        
        return {
          success: true,
          message: `Cleared ${transCount.count} transactions, ${invCount.count} inventory items, and ${adjCount.count} adjustments`,
          deleted: {
            transactions: transCount.count,
            inventory: invCount.count,
            adjustments: adjCount.count
          }
        };
      } catch (error) {
        invDb.prepare("ROLLBACK").run();
        throw error;
      }
    } catch (error) {
      console.error("Error clearing all data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear all data"
      };
    }
  });
}

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
          description,
          cost,
          price,
          quantity,
          updated_at
        FROM inventory
        WHERE quantity >= 0
      `).all() as Array<{
        upc: string;
        description: string;
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
      
      // Get categories from products database
      let categoryMap = new Map<string, string>();
      if (productsDb) {
        try {
          const products = productsDb.prepare(`
            SELECT upc, category FROM products
          `).all() as Array<{ upc: string; category: string | null }>;
          
          products.forEach(p => {
            if (p.category) categoryMap.set(p.upc, p.category);
          });
        } catch (err) {
          console.log("Could not fetch product categories:", err);
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
        
        const daysInStock = lastSold 
          ? Math.floor((Date.now() - new Date(lastSold).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        return {
          upc: item.upc,
          description: item.description,
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
  // Login
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
      const storeDb = getStoreInfoDb();
      
      // Check if any users exist (should be empty during initial setup)
      const userCount = storeDb.prepare("SELECT COUNT(*) as count FROM users").get() as any;
      if (userCount.count > 0) {
        return {
          success: false,
          error: "Users already exist. Use normal add-user for additional users."
        };
      }
      
      // Insert the first admin user
      const result = storeDb.prepare(`
        INSERT INTO users (username, password, role, full_name) 
        VALUES (?, ?, ?, ?)
      `).run(userData.username, userData.password, userData.role, userData.fullName);
      
      return {
        success: true,
        userId: result.lastInsertRowid
      };
    } catch (error) {
      console.error("Add setup user error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create admin user"
      };
    }
  });
  
  // Add user (admin only)
  ipcMain.handle("add-user", async (_, userData: {
    username: string;
    password: string;
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
      
      // Insert new user
      const result = storeDb.prepare(`
        INSERT INTO users (username, password, role, full_name, created_by) 
        VALUES (?, ?, ?, ?, ?)
      `).run(userData.username, userData.password, userData.role, userData.fullName, currentUser.id);
      
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