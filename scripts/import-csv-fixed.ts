// import-csv-fixed.ts
import Database from 'better-sqlite3';
import * as fs from 'fs';
import Papa from 'papaparse';  // Changed: removed * as

async function importCSV() {
  console.log('Starting CSV import with UPC fix...');
  
  const csvFile = fs.readFileSync('LiquorDatabase.csv', 'utf8');
  
  const { data, errors } = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,  // Keep everything as strings!
    transformHeader: (header) => header.trim(),  // Clean headers
    transform: (value) => {
      // Remove quotes and trim whitespace
      if (typeof value === 'string') {
        return value.replace(/^"|"$/g, '').trim();
      }
      return value;
    }
  });

  if (errors.length > 0) {
    console.error('CSV parsing errors:', errors);
  }

  console.log(`Parsed ${data.length} rows`);

  const db = new Database('LiquorDatabase.db');
  
  // Create table with UPC as TEXT
  db.exec(`
    DROP TABLE IF EXISTS products;
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upc TEXT,
      brand TEXT,
      description TEXT,
      size TEXT,
      category TEXT,
      price REAL,
      on_hand INTEGER,
      retail_price REAL,
      tpr_price REAL,
      tpr_start TEXT,
      tpr_end TEXT,
      vendor TEXT,
      vendor_number TEXT,
      case_cost REAL,
      pack INTEGER,
      bottle_cost REAL,
      liter_cost REAL
    );
    
    CREATE INDEX idx_upc ON products(upc);
    CREATE INDEX idx_brand ON products(brand);
    CREATE INDEX idx_description ON products(description);
  `);

  const insert = db.prepare(`
    INSERT INTO products (
      upc, brand, description, size, category, price, on_hand,
      retail_price, tpr_price, tpr_start, tpr_end, vendor,
      vendor_number, case_cost, pack, bottle_cost, liter_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.UPC || null,
        row['Vendor Name'] || null,  // Using Vendor Name as Brand
        row['Item Description'] || null,
        row['Bottle Volume (mL)'] || null,
        row['Category Name'] || null,
        parseFloat(row['State Bottle Cost']) || 0,  // Using as Price
        parseInt(row['SCC']) || 0,  // Using SCC as On Hand
        parseFloat(row['State Bottle Retail']) || 0,
        null,  // No TPR Price in CSV
        null,  // No TPR Start
        null,  // No TPR End
        row['Vendor'] || null,
        row['Item Number'] || null,
        parseFloat(row['State Case Cost']) || 0,
        parseInt(row['Inner Pack']) || parseInt(row['Pack']) || 0,
        parseFloat(row['State Bottle Cost']) || 0,
        null  // No Liter Cost
      );
    }
  });

  insertMany(data);
  
  // Verify the import
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
  const sample = db.prepare('SELECT upc, brand, description FROM products WHERE upc IS NOT NULL LIMIT 5').all();
  
  console.log(`✓ Imported ${count.count} products`);
  console.log('\nSample UPCs (check for leading zeros):');
  sample.forEach(p => {
    console.log(`  UPC: ${p.upc} | ${p.brand} - ${p.description}`);
  });
  
  db.close();
}

// Install papaparse if needed
console.log('Make sure papaparse is installed: pnpm add papaparse @types/papaparse');

importCSV().catch(console.error);