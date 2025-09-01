const Database = require('better-sqlite3');
const path = require('path');

console.log('Testing COMPLETE factory reset...');
console.log('======================================');

const inventoryDb = new Database('./LiquorInventory.db');
const storeDb = new Database('./StoreInformation.db');

try {
  console.log('\n1. BEFORE RESET - Checking current data:');
  console.log('----------------------------------------');
  
  // Check current data in store database
  const userCountBefore = storeDb.prepare("SELECT COUNT(*) as count FROM users").get();
  const storeInfoBefore = storeDb.prepare("SELECT COUNT(*) as count FROM store_info").get();
  const activityBefore = storeDb.prepare("SELECT COUNT(*) as count FROM user_activity").get();
  
  console.log('Store Database:');
  console.log('- Users:', userCountBefore.count);
  console.log('- Store Info:', storeInfoBefore.count);
  console.log('- User Activity:', activityBefore.count);
  
  // Show existing users
  if (userCountBefore.count > 0) {
    const users = storeDb.prepare("SELECT username, role FROM users").all();
    console.log('- Existing users:', users);
  }
  
  // Check inventory database (handle missing tables)
  let invCountBefore = { count: 0 };
  let transCountBefore = { count: 0 };
  
  try {
    invCountBefore = inventoryDb.prepare('SELECT COUNT(*) as count FROM inventory').get();
    transCountBefore = inventoryDb.prepare('SELECT COUNT(*) as count FROM transactions').get();
  } catch (e) {
    console.log('Note: Some inventory tables do not exist yet');
  }
  
  console.log('\nInventory Database:');
  console.log('- Inventory items:', invCountBefore.count);
  console.log('- Transactions:', transCountBefore.count);
  
  console.log('\n2. PERFORMING FACTORY RESET:');
  console.log('----------------------------------------');
  
  // Clear inventory database (handle missing tables)
  console.log('Clearing inventory database...');
  try {
    // Check which tables exist
    const tables = inventoryDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Existing inventory tables:', tables.map(t => t.name));
    
    inventoryDb.exec(`BEGIN TRANSACTION`);
    
    // Only delete from tables that exist
    for (const table of tables) {
      if (table.name !== 'sqlite_sequence' && table.name !== 'till_settings') {
        try {
          inventoryDb.exec(`DELETE FROM ${table.name}`);
          console.log(`  Cleared table: ${table.name}`);
        } catch (e) {
          console.log(`  Warning: Could not clear ${table.name}:`, e.message);
        }
      }
    }
    
    // Always clear sqlite_sequence if it exists
    try {
      inventoryDb.exec(`DELETE FROM sqlite_sequence`);
    } catch (e) {
      // Ignore if doesn't exist
    }
    
    inventoryDb.exec(`COMMIT`);
    
    // Reset till settings if table exists
    try {
      inventoryDb.exec(`
        UPDATE till_settings SET 
          enabled = 0,
          ones = 0,
          fives = 0,
          tens = 0,
          twenties = 0,
          fifties = 0,
          hundreds = 0,
          updated_at = datetime('now');
      `);
    } catch (e) {
      console.log('  Note: till_settings table does not exist');
    }
  } catch (e) {
    console.log('Error clearing inventory database:', e.message);
    try { inventoryDb.exec(`ROLLBACK`); } catch {} 
  }
  
  console.log('✓ Inventory database cleared');
  
  // Clear store database - DELETE ALL USERS AND EVERYTHING
  console.log('Clearing store database...');
  storeDb.exec(`
    BEGIN TRANSACTION;
    DELETE FROM user_activity;
    DELETE FROM time_clock;
    DELETE FROM users;  -- DELETE ALL USERS, NO EXCEPTIONS
    DELETE FROM store_info;
    DELETE FROM sqlite_sequence;
    COMMIT;
  `);
  
  console.log('✓ Store database cleared');
  
  console.log('\n3. AFTER RESET - Verifying complete reset:');
  console.log('----------------------------------------');
  
  // Verify the reset
  const userCountAfter = storeDb.prepare("SELECT COUNT(*) as count FROM users").get();
  const storeInfoAfter = storeDb.prepare("SELECT COUNT(*) as count FROM store_info").get();
  const activityAfter = storeDb.prepare("SELECT COUNT(*) as count FROM user_activity").get();
  const clockAfter = storeDb.prepare("SELECT COUNT(*) as count FROM time_clock").get();
  
  // Check inventory tables (handle missing tables)
  let invCountAfter = { count: 0 };
  let transCountAfter = { count: 0 };
  let adjustCountAfter = { count: 0 };
  let tillCountAfter = { count: 0 };
  let payoutCountAfter = { count: 0 };
  let empClockAfter = { count: 0 };
  
  try { invCountAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM inventory').get(); } catch {}
  try { transCountAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM transactions').get(); } catch {}
  try { adjustCountAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM inventory_adjustments').get(); } catch {}
  try { tillCountAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM daily_till').get(); } catch {}
  try { payoutCountAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM payouts').get(); } catch {}
  try { empClockAfter = inventoryDb.prepare('SELECT COUNT(*) as count FROM employee_time_clock').get(); } catch {}
  
  console.log('Store Database:');
  console.log('- Users:', userCountAfter.count, userCountAfter.count === 0 ? '✓' : '✗ FAILED - Users still exist!');
  console.log('- Store Info:', storeInfoAfter.count, storeInfoAfter.count === 0 ? '✓' : '✗');
  console.log('- User Activity:', activityAfter.count, activityAfter.count === 0 ? '✓' : '✗');
  console.log('- Time Clock:', clockAfter.count, clockAfter.count === 0 ? '✓' : '✗');
  
  console.log('\nInventory Database:');
  console.log('- Inventory items:', invCountAfter.count, invCountAfter.count === 0 ? '✓' : '✗');
  console.log('- Transactions:', transCountAfter.count, transCountAfter.count === 0 ? '✓' : '✗');
  console.log('- Adjustments:', adjustCountAfter.count, adjustCountAfter.count === 0 ? '✓' : '✗');
  console.log('- Daily Till:', tillCountAfter.count, tillCountAfter.count === 0 ? '✓' : '✗');
  console.log('- Payouts:', payoutCountAfter.count, payoutCountAfter.count === 0 ? '✓' : '✗');
  console.log('- Employee Clock:', empClockAfter.count, empClockAfter.count === 0 ? '✓' : '✗');
  
  // Check if reset was successful
  const allClear = userCountAfter.count === 0 && 
                   storeInfoAfter.count === 0 && 
                   invCountAfter.count === 0 && 
                   transCountAfter.count === 0;
  
  console.log('\n======================================');
  if (allClear) {
    console.log('✓✓✓ FACTORY RESET COMPLETED SUCCESSFULLY! ✓✓✓');
    console.log('All data has been cleared.');
    console.log('The system is now in a blank state.');
    console.log('Initial setup will be required on next app launch.');
  } else {
    console.log('✗✗✗ FACTORY RESET FAILED! ✗✗✗');
    console.log('Some data remains in the database.');
    if (userCountAfter.count > 0) {
      const remainingUsers = storeDb.prepare("SELECT * FROM users").all();
      console.log('Remaining users:', remainingUsers);
    }
  }
  console.log('======================================');
  
} catch (error) {
  console.error('Error during factory reset:', error);
} finally {
  inventoryDb.close();
  storeDb.close();
}