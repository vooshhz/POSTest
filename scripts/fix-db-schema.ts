import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get the database path
const inventoryDbPath = path.join(__dirname, '..', 'LiquorInventory.db');

console.log('Fixing database schema at:', inventoryDbPath);

try {
  const db = new Database(inventoryDbPath);
  
  // Check if the columns exist
  const adjustmentsInfo = db.pragma("table_info(inventory_adjustments)");
  const hasUserIdColumn = (adjustmentsInfo as any[]).some((col: any) => col.name === 'created_by_user_id');
  const hasUsernameColumn = (adjustmentsInfo as any[]).some((col: any) => col.name === 'created_by_username');
  
  console.log('Current inventory_adjustments columns:', adjustmentsInfo);
  console.log('Has created_by_user_id:', hasUserIdColumn);
  console.log('Has created_by_username:', hasUsernameColumn);
  
  if (!hasUserIdColumn || !hasUsernameColumn) {
    console.log('Adding missing columns to inventory_adjustments table...');
    
    try {
      if (!hasUserIdColumn) {
        db.exec('ALTER TABLE inventory_adjustments ADD COLUMN created_by_user_id INTEGER');
        console.log('✅ Added created_by_user_id column');
      }
      
      if (!hasUsernameColumn) {
        db.exec('ALTER TABLE inventory_adjustments ADD COLUMN created_by_username TEXT');
        console.log('✅ Added created_by_username column');
      }
    } catch (alterError) {
      console.error('Error adding columns:', alterError);
    }
  } else {
    console.log('✅ All required columns already exist');
  }
  
  // Also check transactions table
  const transactionsInfo = db.pragma("table_info(transactions)");
  const transHasUserIdColumn = (transactionsInfo as any[]).some((col: any) => col.name === 'created_by_user_id');
  const transHasUsernameColumn = (transactionsInfo as any[]).some((col: any) => col.name === 'created_by_username');
  
  console.log('\nCurrent transactions columns:', transactionsInfo);
  console.log('Has created_by_user_id:', transHasUserIdColumn);
  console.log('Has created_by_username:', transHasUsernameColumn);
  
  if (!transHasUserIdColumn || !transHasUsernameColumn) {
    console.log('Adding missing columns to transactions table...');
    
    try {
      if (!transHasUserIdColumn) {
        db.exec('ALTER TABLE transactions ADD COLUMN created_by_user_id INTEGER');
        console.log('✅ Added created_by_user_id column to transactions');
      }
      
      if (!transHasUsernameColumn) {
        db.exec('ALTER TABLE transactions ADD COLUMN created_by_username TEXT');
        console.log('✅ Added created_by_username column to transactions');
      }
    } catch (alterError) {
      console.error('Error adding columns to transactions:', alterError);
    }
  } else {
    console.log('✅ All required columns already exist in transactions table');
  }
  
  // Verify the changes
  console.log('\n=== Verification ===');
  const finalAdjustmentsInfo = db.pragma("table_info(inventory_adjustments)");
  console.log('Final inventory_adjustments schema:', finalAdjustmentsInfo);
  
  const finalTransactionsInfo = db.pragma("table_info(transactions)");
  console.log('Final transactions schema:', finalTransactionsInfo);
  
  db.close();
  console.log('\n✅ Database schema fix completed successfully');
  
} catch (error) {
  console.error('Error fixing database schema:', error);
  process.exit(1);
}