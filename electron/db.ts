// electron/db.ts
import { IpcMain } from "electron";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import Papa from "papaparse";

// Separate database connections
const productsDbPath = path.join(process.cwd(), "LiquorDatabase.db");
const inventoryDbPath = path.join(process.cwd(), "LiquorInventory.db");

let productsDb: Database.Database | null = null;
let inventoryDb: Database.Database | null = null;

// Get products database (read-only for product catalog)
function getProductsDb() {
  if (!productsDb) {
    productsDb = new Database(productsDbPath, { readonly: true });
  }
  return productsDb;
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

export function registerInventoryIpc(ipcMain: IpcMain) {
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

      const insertMany = newDb.transaction((rows: any[]) => {
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
      
      const count = newDb.prepare('SELECT COUNT(*) as count FROM products').get() as any;
      
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
});