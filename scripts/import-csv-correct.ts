// import-csv-correct.ts
import Database from 'better-sqlite3';
import * as fs from 'fs';
import Papa from 'papaparse';

async function importCSV() {
  console.log('Starting CSV import with CORRECT column names...');
  
  // Check if CSV exists
  if (!fs.existsSync('LiquorDatabase.csv')) {
    console.error('ERROR: LiquorDatabase.csv not found in scripts folder!');
    console.log('Current directory:', process.cwd());
    console.log('Files in directory:', fs.readdirSync('.'));
    return;
  }
  
  const csvFile = fs.readFileSync('LiquorDatabase.csv', 'utf8');
  console.log('CSV file loaded, size:', csvFile.length, 'characters');
  
  const { data, errors } = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (header) => header.trim(),
    transform: (value) => {
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
  
  // Create table with EXACT column names from your CSV
  db.exec(`
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

  const insert = db.prepare(`
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

  const insertMany = db.transaction((rows: any[]) => {
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
  
  // Verify the import
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
  const sample = db.prepare('SELECT "UPC", "Item Description", "Bottle Volume (ml)" FROM products LIMIT 3').all() as any[];
  
  console.log(`✓ Imported ${count.count} products`);
  console.log('\nSample data:');
  sample.forEach((p: any) => {
    console.log(`  UPC: ${p.UPC} | ${p['Item Description']} | Volume: ${p['Bottle Volume (ml)']} ml`);
  });
  
  db.close();
  console.log('\n✅ Database created with EXACT column names from CSV!');
}

importCSV().catch(console.error);