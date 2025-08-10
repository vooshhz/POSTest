// scripts/remove-inventory-table.ts
import Database from 'better-sqlite3';
import * as fs from 'fs';

function removeInventoryTable() {
  const dbPath = 'LiquorDatabase.db';
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error('❌ LiquorDatabase.db not found!');
    return;
  }
  
  console.log('Opening database...');
  const db = new Database(dbPath);
  
  try {
    // Check if inventory table exists
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory'").get();
    
    if (table) {
      console.log('Found inventory table. Removing...');
      db.exec('DROP TABLE inventory');
      console.log('✅ Inventory table removed successfully!');
    } else {
      console.log('ℹ️ No inventory table found in database.');
    }
    
    // Show remaining tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('\nRemaining tables in database:');
    tables.forEach((t: any) => console.log('  -', t.name));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    db.close();
    console.log('\nDatabase closed.');
  }
}

removeInventoryTable();