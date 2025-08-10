import { IpcMain } from "electron";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import Papa from "papaparse";

// Create database connection
const dbPath = path.join(process.cwd(), "LiquorDatabase.db");
let db: Database.Database | null = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

// Product interface
interface Product {
  upc: string;
  category: string | null;
  description: string | null;
  volume: string | null;
  pack: number | null;
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

      // Close readonly connection and create writable one
      if (db) {
        db.close();
        db = null;
      }

      const newDb = new Database(dbPath);
      
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
      db = null; // Reset to force reconnection with readonly

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
      const db = getDb();
      
      // Using the EXACT column names from the database
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
      
      const product = db.prepare(query).get(upc) as Product | undefined;
      
      // Debug log to see what we're getting
      console.log("Found product:", product);
      
      if (product) {
        return {
          success: true,
          data: product
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
}

// Cleanup on app quit
process.on("exit", () => {
  if (db) {
    db.close();
  }
});