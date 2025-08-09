import { app, IpcMain } from "electron";
import path from "node:path";
import { createRequire } from "node:module";
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);
// Load native module in CJS context to avoid ESM __filename issues
const Database = require("better-sqlite3") as any;

let _db: any;

function db() {
  if (!_db) {
    const file = path.join(app.getPath("userData"), "pos.sqlite");
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS Product(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        barcode TEXT,
        price_cents INTEGER DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS StockLedger(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        qty_delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES Product(id)
      );
    `);
  }
  return _db!;
}

export function addToInventory(sku: string, name: string, qty: number) {
  const d = db();
  const row = d.prepare("SELECT id FROM Product WHERE sku=?").get(sku) as { id: number } | undefined;
  const id =
    row?.id ?? Number(d.prepare("INSERT INTO Product (sku, name) VALUES (?, ?)").run(sku, name).lastInsertRowid);
  d.prepare("INSERT INTO StockLedger (product_id, qty_delta, reason) VALUES (?, ?, 'PURCHASE')").run(id, qty);
  const { on_hand } = d
    .prepare("SELECT COALESCE(SUM(qty_delta),0) AS on_hand FROM StockLedger WHERE product_id=?")
    .get(id) as { on_hand: number };
  return { productId: id, onHand: on_hand };
}

function normalizeUPC(value: any): string {
  if (value === null || value === undefined) return '';
  
  // Handle different data types
  let upcStr = '';
  
  if (typeof value === 'number') {
    // Handle scientific notation and large numbers
    if (value > 1e10) {
      // Likely a large number that might be in scientific notation
      upcStr = value.toFixed(0);
    } else {
      upcStr = value.toString();
    }
  } else {
    upcStr = value.toString().trim();
  }
  
  // Remove all non-digit characters
  const digitsOnly = upcStr.replace(/\D/g, '');
  
  // Pad with leading zeros to make it 12 digits if it's shorter
  return digitsOnly.padStart(12, '0');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

export function searchProductByUPC(upc: string) {
  console.log('Searching for UPC:', upc);
  try {
    const fs = require('fs');
    
    // Look for CSV file
    const csvPath = path.join(process.cwd(), 'Products.csv');
    
    console.log('Looking for CSV file at:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      console.log('CSV file not found');
      return null;
    }
    
    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    console.log('CSV data loaded, rows:', lines.length - 1);
    
    if (lines.length === 0) {
      console.log('No data found in CSV file');
      return null;
    }
    
    // Parse headers
    const headers = parseCSVLine(lines[0]);
    console.log('Headers found:', headers.map(h => `"${h}"`));
    
    // Find UPC column
    const upcColumnIndex = headers.findIndex((header: string) => 
      header && header.toLowerCase().trim() === 'upc'
    );
    
    console.log('UPC column index:', upcColumnIndex);
    
    if (upcColumnIndex === -1) {
      console.log('No UPC column found');
      return null;
    }
    
    // Normalize the search UPC
    const searchUPC = normalizeUPC(upc);
    console.log('Normalized search UPC:', searchUPC);
    
    // Search through rows
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row || row.length <= upcColumnIndex) continue;
      
      const rowUPCRaw = row[upcColumnIndex];
      if (!rowUPCRaw) continue;
      
      // Normalize the row UPC
      const rowUPC = normalizeUPC(rowUPCRaw);
      
      // Only log first few rows and potential matches to avoid spam
      if (i <= 5 || rowUPC === searchUPC) {
        console.log(`Row ${i}: Raw UPC = "${rowUPCRaw}" (type: ${typeof rowUPCRaw}), Normalized = "${rowUPC}", Target = "${searchUPC}"`);
      }
      
      if (rowUPC === searchUPC) {
        console.log('Found matching UPC at row', i);
        
        // Build product object using the actual header names
        const result = {
          itemNumber: (row[headers.indexOf('Item Number')] || '').toString(),
          categoryName: (row[headers.indexOf('Category Name')] || '').toString(),
          itemDescription: (row[headers.indexOf('Item Description')] || '').toString(),
          vendor: (row[headers.indexOf('Vendor')] || '').toString(),
          vendorName: (row[headers.indexOf('Vendor Name')] || '').toString(),
          bottleVolumeML: (row[headers.indexOf('Bottle Volume (ml)')] || '').toString(),
          pack: (row[headers.indexOf('Pack')] || '').toString(),
          upc: rowUPCRaw.toString(),
          stateBottleCost: (row[headers.indexOf('State Bottle Cost')] || '').toString(),
          stateBottleRetail: (row[headers.indexOf('State Bottle Retail')] || '').toString()
        };
        
        console.log('Returning product:', result);
        return result;
      }
    }
    
    console.log(`No matching UPC found for: ${searchUPC} in ${lines.length - 1} rows`);
    return null;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return null;
  }
}

export function registerInventoryIpc(ipcMain: IpcMain) {
  ipcMain.handle("inventory:add", (_e, p: { sku: string; name: string; qty: number }) =>
    addToInventory(p.sku, p.name, Number(p.qty))
  );
  
  ipcMain.handle("product:searchByUPC", (_e, upc: string) =>
    searchProductByUPC(upc)
  );
}
