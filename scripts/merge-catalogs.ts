import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const catalogsDir = path.join(process.cwd(), "MasterCatalogs");
const outputPath = path.join(process.cwd(), "ProductCatalog.db");

// Source databases
const sources = [
  { file: "MasterBeer.db", table: "beer" },
  { file: "MasterBeverages.db", table: "beverages" },
  { file: "MasterLiquor.db", table: "liquor" },
];

console.log("Starting catalog merge...");

// Delete existing output if it exists
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
  console.log("Deleted existing ProductCatalog.db");
}

// Create new database
const db = new Database(outputPath);

// Create unified products table with columns matching what db.ts expects
db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upc TEXT,
    name TEXT,
    description TEXT,
    brand TEXT,
    manufacturer TEXT,
    vendor_distributor TEXT,
    category TEXT,
    sub_category TEXT,
    volume_metric TEXT,
    pack_size TEXT,
    case_size TEXT,
    price REAL,
    cost REAL,
    alcohol_proof TEXT,
    abv TEXT,
    bottle_deposit_yn TEXT,
    bottle_deposit_amount REAL,
    source_catalog TEXT
  );

  CREATE INDEX idx_products_upc ON products(upc);
  CREATE INDEX idx_products_name ON products(name);
  CREATE INDEX idx_products_category ON products(category);
  CREATE INDEX idx_products_brand ON products(brand);
`);

console.log("Created products table with indexes");

// Prepare insert statement
const insertStmt = db.prepare(`
  INSERT INTO products (
    upc, name, description, brand, manufacturer, vendor_distributor,
    category, sub_category, volume_metric, pack_size, case_size,
    price, cost, alcohol_proof, abv, bottle_deposit_yn, bottle_deposit_amount,
    source_catalog
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?
  )
`);

let totalInserted = 0;

// Process each source database
for (const source of sources) {
  const sourcePath = path.join(catalogsDir, source.file);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    continue;
  }

  const sourceDb = new Database(sourcePath, { readonly: true });

  const rows = sourceDb.prepare(`SELECT * FROM ${source.table}`).all() as any[];

  console.log(`Processing ${source.file}: ${rows.length} rows`);

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      insertStmt.run(
        row.upc,
        row.name,
        row.description,
        row.brand,
        row.manufacturer,
        row.vendor_distributor,
        row.category,
        row.sub_category,
        row.volume_metric,
        row.pack_size,
        row.case_size,
        row.price,
        row.cost,
        row.alcohol_proof,
        row.abv,
        row.bottle_deposit_yn,
        row.bottle_deposit_amount,
        source.table // Track which catalog it came from
      );
    }
  });

  insertMany(rows);
  totalInserted += rows.length;

  sourceDb.close();
  console.log(`  Inserted ${rows.length} products from ${source.table}`);
}

// Verify
const count = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
console.log(`\nTotal products in merged database: ${count.count}`);

// Show sample
const sample = db.prepare("SELECT upc, name, category, source_catalog FROM products LIMIT 5").all();
console.log("\nSample products:");
console.table(sample);

db.close();
console.log(`\nMerge complete! Created: ${outputPath}`);
