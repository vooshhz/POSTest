import Database from 'better-sqlite3';

const db = new Database('LiquorDatabase.db', { readonly: true });

// Check table structure
console.log('\n=== TABLE STRUCTURE ===');
const tableInfo = db.prepare("PRAGMA table_info(products)").all();
console.log(tableInfo.map((col: any) => col.name).join(', '));

// Check first few products with UPC
console.log('\n=== SAMPLE DATA ===');
const products = db.prepare(`
  SELECT upc, description, size, pack, category 
  FROM products 
  WHERE upc IS NOT NULL 
  LIMIT 5
`).all();

products.forEach((p: any) => {
  console.log(`UPC: ${p.upc}`);
  console.log(`  Description: ${p.description}`);
  console.log(`  Size: ${p.size}`);
  console.log(`  Pack: ${p.pack}`);
  console.log(`  Category: ${p.category}`);
  console.log('---');
});

// Check specific UPC
const testUpc = '0880040022723';
console.log(`\n=== CHECKING UPC ${testUpc} ===`);
const specific = db.prepare('SELECT * FROM products WHERE upc = ?').get(testUpc);
console.log(specific);

db.close();