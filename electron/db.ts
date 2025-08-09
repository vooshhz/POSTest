import { app, IpcMain } from "electron";
import path from "node:path";
import { createRequire } from "node:module";
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as any;

// Cache for API results to avoid hitting rate limits
const barcodeCache = new Map<string, any>();

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
  
  let upcStr = '';
  
  if (typeof value === 'number') {
    if (value > 1e10) {
      upcStr = value.toFixed(0);
    } else {
      upcStr = value.toString();
    }
  } else {
    upcStr = value.toString().trim();
  }
  
  const digitsOnly = upcStr.replace(/\D/g, '');
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
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// Search local CSV file
function searchLocalCSV(upc: string) {
  console.log('Searching local CSV for UPC:', upc);
  try {
    const fs = require('fs');
    const csvPath = path.join(process.cwd(), 'Products.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.log('CSV file not found');
      return null;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return null;
    }
    
    const headers = parseCSVLine(lines[0]);
    const upcColumnIndex = headers.findIndex((header: string) => 
      header && header.toLowerCase().trim() === 'upc'
    );
    
    if (upcColumnIndex === -1) {
      return null;
    }
    
    const searchUPC = normalizeUPC(upc);
    
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row || row.length <= upcColumnIndex) continue;
      
      const rowUPCRaw = row[upcColumnIndex];
      if (!rowUPCRaw) continue;
      
      const rowUPC = normalizeUPC(rowUPCRaw);
      
      if (rowUPC === searchUPC) {
        console.log('Found in local CSV');
        return {
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
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return null;
  }
}

// Append product to CSV file
function appendToCSV(product: any) {
  try {
    const fs = require('fs');
    const csvPath = path.join(process.cwd(), 'Products.csv');
    
    // Create backup first time we modify the CSV each day
    const today = new Date().toISOString().split('T')[0];
    const backupPath = path.join(process.cwd(), `Products_backup_${today}.csv`);
    
    if (fs.existsSync(csvPath) && !fs.existsSync(backupPath)) {
      fs.copyFileSync(csvPath, backupPath);
      console.log('Created daily backup:', backupPath);
    }
    
    // Check if CSV exists
    if (!fs.existsSync(csvPath)) {
      console.log('Creating new Products.csv file');
      // Create header if file doesn't exist
      const headers = 'Item Number,Category Name,Item Description,Vendor,Vendor Name,Bottle Volume (ml),Pack,UPC,State Bottle Cost,State Bottle Retail\n';
      fs.writeFileSync(csvPath, headers);
    }
    
    // Format product data for CSV
    const csvRow = [
      product.itemNumber || '',
      product.categoryName || '',
      `"${(product.itemDescription || '').replace(/"/g, '""')}"`, // Escape quotes
      product.vendor || '',
      product.vendorName || '',
      product.bottleVolumeML || '',
      product.pack || '1',
      product.upc || '',
      product.stateBottleCost || '',
      product.stateBottleRetail || ''
    ].join(',');
    
    // Append to CSV
    fs.appendFileSync(csvPath, '\n' + csvRow);
    console.log('Added product to CSV:', product.itemDescription);
    
    return true;
  } catch (error) {
    console.error('Error appending to CSV:', error);
    return false;
  }
}

// Search using BarcodeLookup API
async function searchBarcodeLookupAPI(upc: string) {
  // Check cache first
  if (barcodeCache.has(upc)) {
    console.log('Returning cached result for UPC:', upc);
    return barcodeCache.get(upc);
  }

  const apiKey = process.env.BARCODE_LOOKUP_API_KEY;
  
  if (!apiKey) {
    console.log('BarcodeLookup API key not configured');
    return null;
  }

  try {
    console.log('Calling BarcodeLookup API for UPC:', upc);
    
    const response = await axios.get('https://api.barcodelookup.com/v3/products', {
      params: {
        barcode: upc,
        key: apiKey
      },
      timeout: 5000 // 5 second timeout
    });

    if (response.data && response.data.products && response.data.products.length > 0) {
      const product = response.data.products[0];
      console.log('Found product via API:', product.title);
      
      // Map API response to your product structure
      const mappedProduct = {
        itemNumber: product.mpn || '',
        categoryName: product.category || '',
        itemDescription: product.title || product.product_name || '',
        vendor: product.manufacturer || product.brand || '',
        vendorName: product.manufacturer || product.brand || '',
        bottleVolumeML: product.size || '',
        pack: '1', // API doesn't provide pack info
        upc: product.barcode_number || upc,
        stateBottleCost: '', // API doesn't provide cost
        stateBottleRetail: product.stores && product.stores.length > 0 
          ? product.stores[0].price 
          : ''
      };
      
      // Cache the result
      barcodeCache.set(upc, mappedProduct);
      
      // Auto-save to CSV for future lookups
      appendToCSV(mappedProduct);
      
      return mappedProduct;
    }
    
    // Cache null result to avoid repeated API calls for not found items
    barcodeCache.set(upc, null);
    return null;
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('Product not found in BarcodeLookup API');
      barcodeCache.set(upc, null);
    } else if (error.response?.status === 403) {
      console.error('BarcodeLookup API key invalid or rate limit exceeded');
    } else {
      console.error('BarcodeLookup API error:', error.message);
    }
    return null;
  }
}

export async function searchProductByUPC(upc: string) {
  console.log('Starting product search for UPC:', upc);
  
  // Try local CSV first (faster and no API limits)
  const localResult = searchLocalCSV(upc);
  if (localResult) {
    return localResult;
  }
  
  // If not found locally, try BarcodeLookup API
  const apiResult = await searchBarcodeLookupAPI(upc);
  if (apiResult) {
    return apiResult;
  }
  
  console.log('Product not found in any source');
  return null;
}

export function registerInventoryIpc(ipcMain: IpcMain) {
  ipcMain.handle("inventory:add", (_e, p: { sku: string; name: string; qty: number }) =>
    addToInventory(p.sku, p.name, Number(p.qty))
  );
  
  ipcMain.handle("product:searchByUPC", (_e, upc: string) =>
    searchProductByUPC(upc)
  );
}