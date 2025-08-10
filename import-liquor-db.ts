// import-liquor-db.ts
// Run this with: npx tsx import-liquor-db.ts
// Or: node --loader ts-node/esm import-liquor-db.ts

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// File paths
const CSV_FILE = 'LiquorDatabase.csv';
const DB_FILE = 'LiquorDatabase.db';

// Create or recreate the database
console.log('Creating SQLite database...');
const db = new Database(DB_FILE);

// Drop table if exists (for clean import)
db.exec('DROP TABLE IF EXISTS products');

// Create table with all 17 columns
db.exec(`
  CREATE TABLE products (
    item_number INTEGER PRIMARY KEY,
    category_name TEXT,
    item_description TEXT,
    vendor INTEGER,
    vendor_name TEXT,
    bottle_volume_ml INTEGER,
    pack INTEGER,
    inner_pack INTEGER,
    age INTEGER,
    proof INTEGER,
    list_date TEXT,
    upc TEXT,
    scc TEXT,
    state_bottle_cost REAL,
    state_case_cost REAL,
    state_bottle_retail REAL,
    report_date TEXT
  )
`);

// Read and parse CSV
console.log('Reading CSV file...');
const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

// Prepare insert statement
const insert = db.prepare(`
  INSERT INTO products (
    item_number,
    category_name,
    item_description,
    vendor,
    vendor_name,
    bottle_volume_ml,
    pack,
    inner_pack,
    age,
    proof,
    list_date,
    upc,
    scc,
    state_bottle_cost,
    state_case_cost,
    state_bottle_retail,
    report_date
  ) VALUES (
    @item_number,
    @category_name,
    @item_description,
    @vendor,
    @vendor_name,
    @bottle_volume_ml,
    @pack,
    @inner_pack,
    @age,
    @proof,
    @list_date,
    @upc,
    @scc,
    @state_bottle_cost,
    @state_case_cost,
    @state_bottle_retail,
    @report_date
  )
`);

// Import data
console.log(`Importing ${records.length} products...`);
const insertMany = db.transaction((records) => {
  for (const record of records) {
    // Map CSV headers to database columns
    insert.run({
      item_number: parseInt(record['Item Number']) || null,
      category_name: record['Category Name'] || null,
      item_description: record['Item Description'] || null,
      vendor: parseInt(record['Vendor']) || null,
      vendor_name: record['Vendor Name'] || null,
      bottle_volume_ml: parseInt(record['Bottle Volume (ml)']) || null,
      pack: parseInt(record['Pack']) || null,
      inner_pack: parseInt(record['Inner Pack']) || null,
      age: parseInt(record['Age']) || null,
      proof: parseInt(record['Proof']) || null,
      list_date: record['List Date'] || null,
      upc: record['UPC'] || null,
      scc: record['SCC'] || null,
      state_bottle_cost: parseFloat(record['State Bottle Cost']) || null,
      state_case_cost: parseFloat(record['State Case Cost']) || null,
      state_bottle_retail: parseFloat(record['State Bottle Retail']) || null,
      report_date: record['Report Date'] || null
    });
  }
});

// Run the transaction
insertMany(records);

// Create indexes for faster queries
console.log('Creating indexes...');
db.exec(`
  CREATE INDEX idx_category ON products(category_name);
  CREATE INDEX idx_description ON products(item_description);
  CREATE INDEX idx_upc ON products(upc);
  CREATE INDEX idx_vendor ON products(vendor_name);
`);

// Verify import
const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
console.log(`✅ Success! Imported ${count.count} products into ${DB_FILE}`);

// Show sample data
console.log('\nSample data:');
const samples = db.prepare('SELECT item_number, item_description, state_bottle_retail FROM products LIMIT 5').all();
console.table(samples);

db.close();