// Script to clear all data from the database
const Database = require('better-sqlite3');
const path = require('path');

console.log('Starting complete database wipe...\n');

// Open inventory database
const inventoryDbPath = path.join(__dirname, 'LiquorInventory.db');

try {
  const db = new Database(inventoryDbPath);
  
  // Start transaction
  db.prepare('BEGIN TRANSACTION').run();
  
  // Clear all tables
  console.log('Clearing transactions...');
  const transResult = db.prepare('DELETE FROM transactions').run();
  console.log(`  ✓ Deleted ${transResult.changes} transactions`);
  
  console.log('Clearing inventory...');
  const invResult = db.prepare('DELETE FROM inventory').run();
  console.log(`  ✓ Deleted ${invResult.changes} inventory items`);
  
  console.log('Clearing inventory adjustments...');
  const adjResult = db.prepare('DELETE FROM inventory_adjustments').run();
  console.log(`  ✓ Deleted ${adjResult.changes} inventory adjustments`);
  
  // Reset autoincrement counters
  console.log('Resetting ID counters...');
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'inventory', 'inventory_adjustments')").run();
  console.log('  ✓ Reset all autoincrement counters');
  
  // Commit transaction
  db.prepare('COMMIT').run();
  
  console.log('\n✅ All data cleared successfully!\n');
  
  // Verify tables are empty
  const transCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
  const adjCount = db.prepare('SELECT COUNT(*) as count FROM inventory_adjustments').get();
  
  console.log('Verification - All tables should show 0 records:');
  console.log(`  • Transactions: ${transCount.count} records`);
  console.log(`  • Inventory: ${invCount.count} records`);
  console.log(`  • Adjustments: ${adjCount.count} records`);
  
  if (transCount.count === 0 && invCount.count === 0 && adjCount.count === 0) {
    console.log('\n🎉 Database successfully reset to empty state!');
  } else {
    console.log('\n⚠️ Warning: Some records may not have been deleted');
  }
  
  db.close();
  
} catch (error) {
  console.error('Error during cleanup:', error.message);
  console.error('\nNote: Make sure the application is not running when executing this script.');
  process.exit(1);
}