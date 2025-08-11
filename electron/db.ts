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
            parseInt(row['Pack']) || null,
            parseInt(row['Inner Pack']) || null,
            row['Age'] || null,
            row['Proof'] || null,
            row['List Date'] || null,
            row['UPC'] || null,
            row['SCC'] || null,
            parseFloat(row['State Bottle Cost']) || null,
            parseFloat(row['State Case Cost']) || null,
            parseFloat(row['State Bottle Retail']) || null,
            row['Report Date'] || null
          );
        }
      });

      insertMany(data);
      
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
      const enrichedItems = inventoryItems.map((item: Record<string, unknown>) => {
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
      
      // Check if already exists in inventory
      const existing = invDb.prepare(`
        SELECT * FROM inventory WHERE upc = ?
      `).get(item.upc);
      
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
        
        return {
          success: true,
          message: `Inventory updated! Added ${item.quantity} units.`,
          updated: true
        };
      } else {
        // Insert new record
        const stmt = invDb.prepare(`
          INSERT INTO inventory (upc, cost, price, quantity)
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(item.upc, item.cost, item.price, item.quantity);
        
        return {
          success: true,
          message: `Added ${item.quantity} units to inventory!`,
          updated: false
        };
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
        
        // Deduct each item from inventory
        for (const item of items) {
          // Check current quantity
          const currentItem = invDb.prepare(`
            SELECT quantity FROM inventory WHERE upc = ?
          `).get(item.upc) as { quantity: number } | undefined;
          
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
        }
        
        // Save the transaction
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
        ORDER BY created_at DESC
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
          const items = JSON.parse(transaction.items as string);
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
              transaction_id: transaction.transaction_id,
              upc: item.upc,
              description: item.description || product?.description || 'Unknown Item',
              category: product?.category || null,
              volume: product?.volume || null,
              quantity: item.quantity,
              unit_price: item.price,
              total: item.total,
              payment_type: transaction.payment_type,
              transaction_total: transaction.total,
              created_at: transaction.created_at
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