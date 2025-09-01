const Database = require('better-sqlite3');

console.log('Testing mock data generation...');
console.log('======================================');

const inventoryDb = new Database('./LiquorInventory.db');

try {
  // Check current inventory and transactions
  const inventoryCount = inventoryDb.prepare("SELECT COUNT(*) as count FROM inventory").get();
  const transactionCount = inventoryDb.prepare("SELECT COUNT(*) as count FROM transactions").get();
  
  console.log('\nCurrent Database Status:');
  console.log('------------------------');
  console.log('- Inventory items:', inventoryCount.count);
  console.log('- Transactions:', transactionCount.count);
  
  if (inventoryCount.count > 0) {
    console.log('\nSample Inventory Items:');
    const items = inventoryDb.prepare("SELECT upc, quantity, price FROM inventory LIMIT 5").all();
    items.forEach(item => {
      console.log(`  UPC: ${item.upc}, Qty: ${item.quantity}, Price: $${item.price}`);
    });
  }
  
  if (transactionCount.count > 0) {
    console.log('\nRecent Transactions:');
    const transactions = inventoryDb.prepare(`
      SELECT id, total, payment_type, created_at 
      FROM transactions 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    transactions.forEach(t => {
      console.log(`  ID: ${t.id}, Total: $${t.total}, Type: ${t.payment_type}, Date: ${t.created_at}`);
    });
    
    // Check for mock-generated transactions
    const mockTransactions = inventoryDb.prepare(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE created_by_username = 'mock_generator'
    `).get();
    console.log('\n- Mock-generated transactions:', mockTransactions.count);
  }
  
  // Check inventory adjustments
  const adjustmentCount = inventoryDb.prepare("SELECT COUNT(*) as count FROM inventory_adjustments").get();
  console.log('\n- Inventory adjustments:', adjustmentCount.count);
  
} catch (error) {
  console.error('Error checking mock data:', error);
} finally {
  inventoryDb.close();
}

console.log('\n======================================');
console.log('If counts are 0, run the Mock Data By Date Range');
console.log('feature in the Developer section of the app.');
console.log('======================================');