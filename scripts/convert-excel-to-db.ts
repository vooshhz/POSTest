// Script to convert Excel inventory files to SQLite databases
// Uses sql.js which is a pure JavaScript implementation (no native modules)
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const INVENTORY_FOLDER = path.join(process.cwd(), 'INVENTORY DATABASE');

const FILES = [
  { excel: 'Master - LIQUOR MLCC Vishu.xlsx', db: 'MasterLiquor.db', tableName: 'liquor' },
  { excel: 'Master - BEVERAGES Vishu.xlsx', db: 'MasterBeverages.db', tableName: 'beverages' },
  { excel: 'Master - BEER Vishu.xlsx', db: 'MasterBeer.db', tableName: 'beer' }
];

// Column mapping from Excel headers to database column names
const COLUMN_MAP: Record<string, string> = {
  'POS Internal ID': 'pos_internal_id',
  'UPC': 'upc',
  'SKU': 'sku',
  'Brand': 'brand',
  'Manufacturer': 'manufacturer',
  'Vendor/Distributor': 'vendor_distributor',
  'Name': 'name',
  'Description': 'description',
  'Category': 'category',
  'Sub-Catogery': 'sub_category',
  'ABV (Per Unit)': 'abv',
  'Alcohol Proof': 'alcohol_proof',
  'Price': 'price',
  'Price Per Unit': 'price_per_unit',
  'Cost': 'cost',
  'Default tax rates?': 'default_tax_rates',
  'Tax Rates': 'tax_rates',
  'Price Type': 'price_type',
  'Unit Size': 'unit_size',
  'Pack Size': 'pack_size',
  'Case Size': 'case_size',
  'Quantity In Stock': 'quantity_in_stock',
  'Bottle Deposit Y/N': 'bottle_deposit_yn',
  'Bottle Deposit Amount (CRV)': 'bottle_deposit_amount',
  'Weight Imperial (Oz)': 'weight_imperial',
  'Weight Metric (g/kg)': 'weight_metric',
  'Volume Imperial (Fl. Oz)': 'volume_imperial',
  'Volume Metric (ml/l)': 'volume_metric',
  'Type': 'type',
  'Non-revenue item?': 'non_revenue_item',
  'Original_Category': 'original_category',
  'Variant Attribute': 'variant_attribute',
  'Variant Option': 'variant_option',
  'Alternate Name': 'alternate_name',
  'Printer Labels': 'printer_labels',
  'Modifier Groups': 'modifier_groups',
  'Hidden?': 'hidden',
  'Additional Information': 'additional_info',
  'Product_URL': 'product_url'
};

const COLUMN_NAMES = Object.values(COLUMN_MAP);

async function convertFile(SQL: any, excelFile: string, dbFile: string, tableName: string): Promise<boolean> {
  const excelPath = path.join(INVENTORY_FOLDER, excelFile);
  const dbPath = path.join(INVENTORY_FOLDER, dbFile);

  console.log(`\n📂 Converting: ${excelFile}`);
  console.log(`   Source: ${excelPath}`);
  console.log(`   Target: ${dbPath}`);

  // Check if Excel file exists
  if (!fs.existsSync(excelPath)) {
    console.error(`   ❌ Excel file not found: ${excelPath}`);
    return false;
  }

  try {
    // Read Excel file
    console.log(`   📖 Reading Excel file...`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (data.length === 0) {
      console.error(`   ❌ Excel file is empty`);
      return false;
    }

    const headers = data[0] as string[];
    const rows = data.slice(1);

    console.log(`   📊 Found ${rows.length} rows with ${headers.length} columns`);

    // Create database
    const db: SqlJsDatabase = new SQL.Database();

    // Create table
    const createTableSQL = `
      CREATE TABLE ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pos_internal_id TEXT,
        upc TEXT,
        sku TEXT,
        brand TEXT,
        manufacturer TEXT,
        vendor_distributor TEXT,
        name TEXT,
        description TEXT,
        category TEXT,
        sub_category TEXT,
        abv TEXT,
        alcohol_proof TEXT,
        price REAL,
        price_per_unit REAL,
        cost REAL,
        default_tax_rates TEXT,
        tax_rates TEXT,
        price_type TEXT,
        unit_size TEXT,
        pack_size TEXT,
        case_size TEXT,
        quantity_in_stock INTEGER,
        bottle_deposit_yn TEXT,
        bottle_deposit_amount REAL,
        weight_imperial TEXT,
        weight_metric TEXT,
        volume_imperial TEXT,
        volume_metric TEXT,
        type TEXT,
        non_revenue_item TEXT,
        original_category TEXT,
        variant_attribute TEXT,
        variant_option TEXT,
        alternate_name TEXT,
        printer_labels TEXT,
        modifier_groups TEXT,
        hidden TEXT,
        additional_info TEXT,
        product_url TEXT
      );
      CREATE INDEX idx_${tableName}_upc ON ${tableName}(upc);
      CREATE INDEX idx_${tableName}_brand ON ${tableName}(brand);
      CREATE INDEX idx_${tableName}_name ON ${tableName}(name);
      CREATE INDEX idx_${tableName}_category ON ${tableName}(category);
    `;

    db.run(createTableSQL);

    // Prepare insert statement
    const placeholders = COLUMN_NAMES.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO ${tableName} (${COLUMN_NAMES.join(', ')}) VALUES (${placeholders})`;

    // Insert data
    let inserted = 0;
    let skipped = 0;

    db.run('BEGIN TRANSACTION');

    for (const row of rows) {
      // Check if row has at least UPC or name
      const upcIndex = headers.findIndex(h => h === 'UPC');
      const nameIndex = headers.findIndex(h => h === 'Name');
      const hasUpc = upcIndex >= 0 && row[upcIndex];
      const hasName = nameIndex >= 0 && row[nameIndex];

      if (!hasUpc && !hasName) {
        skipped++;
        continue;
      }

      // Reorder values to match our column order
      const orderedValues = COLUMN_NAMES.map(colName => {
        const excelHeader = Object.keys(COLUMN_MAP).find(k => COLUMN_MAP[k] === colName);
        if (!excelHeader) return null;
        const headerIndex = headers.indexOf(excelHeader);
        if (headerIndex < 0) return null;
        const val = row[headerIndex];
        if (val === undefined || val === null || val === '') return null;
        return val;
      });

      try {
        db.run(insertSQL, orderedValues);
        inserted++;
      } catch (e) {
        // Skip rows with errors
        skipped++;
      }
    }

    db.run('COMMIT');

    console.log(`   ✅ Inserted ${inserted} rows (skipped ${skipped} empty rows)`);

    // Verify
    const result = db.exec(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = result[0]?.values[0]?.[0] || 0;
    console.log(`   ✓ Verified: ${count} records in database`);

    // Export to file
    const dbData = db.export();
    const buffer = Buffer.from(dbData);
    fs.writeFileSync(dbPath, buffer);

    db.close();
    console.log(`   💾 Database saved: ${dbFile} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return true;
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Excel to SQLite Database Converter');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\nInventory folder: ${INVENTORY_FOLDER}`);

  if (!fs.existsSync(INVENTORY_FOLDER)) {
    console.error(`\n❌ Inventory folder not found: ${INVENTORY_FOLDER}`);
    process.exit(1);
  }

  // Initialize sql.js
  console.log('\n⏳ Initializing SQL.js...');
  const SQL = await initSqlJs();
  console.log('✅ SQL.js initialized');

  let success = 0;
  let failed = 0;

  for (const file of FILES) {
    if (await convertFile(SQL, file.excel, file.db, file.tableName)) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`   Conversion complete: ${success} succeeded, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
