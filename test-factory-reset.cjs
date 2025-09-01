const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database paths
const inventoryDbPath = path.join(__dirname, 'LiquorInventory.db');
const storeInfoDbPath = path.join(__dirname, 'StoreInformation.db');
const liquorDbPath = path.join(__dirname, 'LiquorDatabase.db');

console.log('=== Factory Reset Test ===\n');

// Check initial database state
console.log('1. Initial Database State:');
console.log(`   LiquorDatabase.db exists: ${fs.existsSync(liquorDbPath)}`);
console.log(`   LiquorInventory.db exists: ${fs.existsSync(inventoryDbPath)}`);
console.log(`   StoreInformation.db exists: ${fs.existsSync(storeInfoDbPath)}`);

if (fs.existsSync(storeInfoDbPath)) {
  const db = new Database(storeInfoDbPath, { readonly: true });
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const storeInfo = db.prepare('SELECT COUNT(*) as count FROM store_info').get();
  console.log(`   Users in StoreInformation.db: ${userCount.count}`);
  console.log(`   Store info entries: ${storeInfo.count}`);
  db.close();
}

if (fs.existsSync(inventoryDbPath)) {
  const db = new Database(inventoryDbPath, { readonly: true });
  const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
  const transCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  console.log(`   Inventory items: ${invCount.count}`);
  console.log(`   Transactions: ${transCount.count}`);
  db.close();
}

console.log('\n2. Simulating Factory Reset...');

// Simulate factory reset
try {
  // Delete databases (except LiquorDatabase.db)
  if (fs.existsSync(inventoryDbPath)) {
    console.log('   Deleting LiquorInventory.db...');
    fs.unlinkSync(inventoryDbPath);
  }
  
  if (fs.existsSync(storeInfoDbPath)) {
    console.log('   Deleting StoreInformation.db...');
    fs.unlinkSync(storeInfoDbPath);
  }
  
  console.log('   ✓ Databases deleted successfully');
} catch (error) {
  console.error('   ✗ Error during deletion:', error.message);
}

console.log('\n3. Post-Reset Database State:');
console.log(`   LiquorDatabase.db exists: ${fs.existsSync(liquorDbPath)} (should be true)`);
console.log(`   LiquorInventory.db exists: ${fs.existsSync(inventoryDbPath)} (should be false)`);
console.log(`   StoreInformation.db exists: ${fs.existsSync(storeInfoDbPath)} (should be false)`);

console.log('\n4. Testing Database Recreation on Next Launch...');

// Test that databases can be recreated
try {
  // Create StoreInformation.db
  console.log('   Creating new StoreInformation.db...');
  const storeDb = new Database(storeInfoDbPath);
  
  storeDb.exec(`
    CREATE TABLE IF NOT EXISTS store_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      tax_rate REAL,
      receipt_header TEXT,
      receipt_footer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      pin TEXT,
      role TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Insert default admin user
  storeDb.prepare(`
    INSERT INTO users (username, password, role, full_name) 
    VALUES ('admin', 'admin', 'admin', 'Administrator')
  `).run();
  
  console.log('   ✓ StoreInformation.db recreated with default admin');
  storeDb.close();
  
  // Create LiquorInventory.db
  console.log('   Creating new LiquorInventory.db...');
  const invDb = new Database(inventoryDbPath);
  
  invDb.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upc TEXT UNIQUE NOT NULL,
      description TEXT,
      quantity INTEGER DEFAULT 0,
      cost REAL,
      price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT,
      subtotal REAL,
      tax REAL,
      total REAL,
      payment_type TEXT,
      cash_given REAL,
      change_given REAL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('   ✓ LiquorInventory.db recreated');
  invDb.close();
  
} catch (error) {
  console.error('   ✗ Error during recreation:', error.message);
}

console.log('\n5. Final Verification:');
console.log(`   LiquorDatabase.db exists: ${fs.existsSync(liquorDbPath)}`);
console.log(`   LiquorInventory.db exists: ${fs.existsSync(inventoryDbPath)}`);
console.log(`   StoreInformation.db exists: ${fs.existsSync(storeInfoDbPath)}`);

if (fs.existsSync(storeInfoDbPath)) {
  const db = new Database(storeInfoDbPath, { readonly: true });
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  console.log(`   Users in new StoreInformation.db: ${userCount.count} (should be 1 - admin)`);
  db.close();
}

console.log('\n=== Test Complete ===');