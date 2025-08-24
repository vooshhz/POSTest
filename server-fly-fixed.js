// server-fly-fixed.js - Fixed server for Fly.io deployment
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// IMPORTANT: Use /data directory for persistent storage on Fly.io
const DATA_DIR = process.env.FLY_APP_NAME ? '/data' : '.';

// Database paths - these will persist on Fly.io
const productsDbPath = path.join(DATA_DIR, 'LiquorDatabase.db');
const inventoryDbPath = path.join(DATA_DIR, 'LiquorInventory.db');
const storeDbPath = path.join(DATA_DIR, 'StoreInformation.db');

// Copy initial databases if they don't exist in /data
function initializeDatabases() {
  const databases = [
    { source: './LiquorDatabase.db', dest: productsDbPath },
    { source: './LiquorInventory.db', dest: inventoryDbPath },
    { source: './StoreInformation.db', dest: storeDbPath }
  ];

  databases.forEach(({ source, dest }) => {
    if (!fs.existsSync(dest) && fs.existsSync(source)) {
      console.log(`Copying ${source} to ${dest}`);
      fs.copyFileSync(source, dest);
    }
  });
}

// Initialize databases on first run
initializeDatabases();

// Database connections
const productsDb = new Database(productsDbPath, { readonly: false });
const inventoryDb = new Database(inventoryDbPath);
const storeDb = new Database(storeDbPath);

console.log('Databases connected from:', DATA_DIR);

// Initialize tables if needed
function initTables() {
  // Ensure inventory table exists
  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upc TEXT UNIQUE NOT NULL,
      cost REAL NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id INTEGER,
      created_by_username TEXT,
      taxable INTEGER DEFAULT 1
    )
  `);

  // Ensure transactions table exists
  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      payment_type TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_by_username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure inventory_adjustments table exists
  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upc TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      created_by_user_id INTEGER,
      created_by_username TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure users table exists
  storeDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT,
      pin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin if no users exist
  const userCount = storeDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    storeDb.prepare(`
      INSERT INTO users (username, password, role) VALUES (?, ?, ?)
    `).run('admin', 'admin123', 'admin');
    console.log('Created default admin user (admin/admin123)');
  }

  console.log('Database tables initialized');
}

initTables();

// API Routes
app.post('/api/search-by-upc', (req, res) => {
  try {
    const { upc } = req.body;
    const product = productsDb.prepare(`
      SELECT * FROM products WHERE UPC = ?
    `).get(upc);
    res.json(product || null);
  } catch (error) {
    console.error('Search by UPC error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/search-products', (req, res) => {
  try {
    const { query } = req.body;
    const products = productsDb.prepare(`
      SELECT * FROM products 
      WHERE "Item Description" LIKE ? 
      OR UPC LIKE ?
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`);
    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory', (req, res) => {
  try {
    // Get inventory items
    const inventory = inventoryDb.prepare(`
      SELECT * FROM inventory
    `).all();
    
    // Join with products to get names
    const inventoryWithNames = inventory.map(item => {
      const product = productsDb.prepare(`
        SELECT "Item Description" as name FROM products WHERE UPC = ?
      `).get(item.upc);
      
      return {
        ...item,
        name: product ? product.name : `Unknown Product (${item.upc})`
      };
    });
    
    res.json(inventoryWithNames);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-inventory', (req, res) => {
  try {
    const { upc } = req.body;
    const item = inventoryDb.prepare(`
      SELECT * FROM inventory WHERE upc = ?
    `).get(upc);
    
    if (item) {
      // Get product name from products database
      const product = productsDb.prepare(`
        SELECT "Item Description" as name FROM products WHERE UPC = ?
      `).get(upc);
      
      res.json({
        ...item,
        name: product ? product.name : `Unknown Product (${upc})`
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Check inventory error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/add-to-inventory', (req, res) => {
  try {
    const { upc, quantity, cost, price, userId, username, taxable = 1 } = req.body;
    inventoryDb.prepare(`
      INSERT INTO inventory (upc, quantity, cost, price, created_by_user_id, created_by_username, taxable)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(upc) DO UPDATE SET
        quantity = quantity + ?,
        cost = ?,
        price = ?,
        updated_at = CURRENT_TIMESTAMP
    `).run(upc, quantity, cost, price, userId, username, taxable, quantity, cost, price);
    res.json({ success: true });
  } catch (error) {
    console.error('Add to inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/update-inventory-quantity', (req, res) => {
  try {
    const { upc, change, reason, userId, username } = req.body;
    
    const transaction = inventoryDb.transaction(() => {
      const current = inventoryDb.prepare('SELECT quantity FROM inventory WHERE upc = ?').get(upc);
      if (!current) throw new Error('Item not found');
      
      const newQuantity = current.quantity + change;
      inventoryDb.prepare('UPDATE inventory SET quantity = ? WHERE upc = ?').run(newQuantity, upc);
      
      inventoryDb.prepare(`
        INSERT INTO inventory_adjustments 
        (upc, adjustment_type, quantity_change, quantity_before, quantity_after, created_by_user_id, created_by_username)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(upc, reason || 'manual', change, current.quantity, newQuantity, userId, username);
    });
    
    transaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-transaction', (req, res) => {
  try {
    const { items, subtotal, tax, total, paymentType, userId, username } = req.body;
    const result = inventoryDb.prepare(`
      INSERT INTO transactions (items, subtotal, tax, total, payment_type, created_by_user_id, created_by_username)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      JSON.stringify(items),
      subtotal,
      tax,
      total,
      paymentType,
      userId,
      username
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/transactions', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM transactions';
    const params = [];
    
    if (startDate && endDate) {
      query += ' WHERE created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    const transactions = inventoryDb.prepare(query).all(...params);
    
    // Parse the items JSON string for each transaction
    const parsedTransactions = transactions.map(transaction => ({
      ...transaction,
      items: typeof transaction.items === 'string' ? JSON.parse(transaction.items) : transaction.items
    }));
    
    res.json(parsedTransactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = storeDb.prepare(`
      SELECT * FROM users WHERE username = ? AND password = ?
    `).get(username, password);
    
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/login-pin', (req, res) => {
  try {
    const { username, pin } = req.body;
    const user = storeDb.prepare(`
      SELECT * FROM users WHERE username = ? AND pin = ?
    `).get(username, pin);
    
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, error: 'Invalid PIN' });
    }
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = storeDb.prepare('SELECT id, username, role, full_name FROM users').all();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-user-type', (req, res) => {
  try {
    const { username } = req.body;
    const user = storeDb.prepare('SELECT id, username, role, pin FROM users WHERE username = ?').get(username);
    
    if (user) {
      res.json({
        success: true,
        role: user.role,
        requiresPin: !!user.pin,
        requiresPassword: !user.pin || user.role !== 'cashier'
      });
    } else {
      res.json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Check user type error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/store-info', (req, res) => {
  try {
    const info = storeDb.prepare('SELECT * FROM store_info LIMIT 1').get();
    res.json(info || {});
  } catch (error) {
    console.error('Get store info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-store-info', (req, res) => {
  try {
    const storeInfo = req.body;
    
    // First, ensure the store_info table exists
    storeDb.exec(`
      CREATE TABLE IF NOT EXISTS store_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT NOT NULL,
        store_address TEXT,
        store_phone TEXT,
        tax_rate REAL DEFAULT 0,
        receipt_header TEXT,
        receipt_footer TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Check if store info already exists
    const existing = storeDb.prepare('SELECT id FROM store_info LIMIT 1').get();
    
    if (existing) {
      // Update existing record
      storeDb.prepare(`
        UPDATE store_info SET
          store_name = ?,
          store_address = ?,
          store_phone = ?,
          tax_rate = ?,
          receipt_header = ?,
          receipt_footer = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        storeInfo.store_name || storeInfo.storeName,
        storeInfo.store_address || storeInfo.storeAddress,
        storeInfo.store_phone || storeInfo.storePhone,
        storeInfo.tax_rate || storeInfo.taxRate || 0,
        storeInfo.receipt_header || storeInfo.receiptHeader || '',
        storeInfo.receipt_footer || storeInfo.receiptFooter || '',
        existing.id
      );
    } else {
      // Insert new record
      storeDb.prepare(`
        INSERT INTO store_info (store_name, store_address, store_phone, tax_rate, receipt_header, receipt_footer)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        storeInfo.store_name || storeInfo.storeName,
        storeInfo.store_address || storeInfo.storeAddress,
        storeInfo.store_phone || storeInfo.storePhone,
        storeInfo.tax_rate || storeInfo.taxRate || 0,
        storeInfo.receipt_header || storeInfo.receiptHeader || '',
        storeInfo.receipt_footer || storeInfo.receiptFooter || ''
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save store info error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/add-user', (req, res) => {
  try {
    const { username, password, role, fullName, pin } = req.body;
    
    // Check if user already exists
    const existing = storeDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    
    if (existing) {
      res.status(400).json({ success: false, error: 'User already exists' });
      return;
    }
    
    // Insert new user
    const result = storeDb.prepare(`
      INSERT INTO users (username, password, role, full_name, pin)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password, role || 'cashier', fullName || username, pin || null);
    
    res.json({ 
      success: true,
      user: {
        id: result.lastInsertRowid,
        username,
        role: role || 'cashier',
        full_name: fullName || username
      }
    });
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/remove-user/:id', (req, res) => {
  try {
    const userId = req.params.id;
    
    // Don't allow deleting the last admin
    const adminCount = storeDb.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
    const userToDelete = storeDb.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    
    if (userToDelete?.role === 'admin' && adminCount.count <= 1) {
      res.status(400).json({ success: false, error: 'Cannot delete the last admin user' });
      return;
    }
    
    // Delete the user
    const result = storeDb.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Setup Kelly endpoint (temporary - for fixing Kelly's account)
app.get('/api/setup-kelly', (req, res) => {
  try {
    // Check if Kelly exists
    const existingKelly = storeDb.prepare('SELECT * FROM users WHERE username = ?').get('kelly');
    
    if (existingKelly) {
      // Update Kelly's PIN and password
      storeDb.prepare(`
        UPDATE users 
        SET password = ?, pin = ?, role = ?, full_name = ?
        WHERE username = ?
      `).run('kelly123', '1234', 'cashier', 'Kelly Smith', 'kelly');
      
      const updatedKelly = storeDb.prepare('SELECT * FROM users WHERE username = ?').get('kelly');
      
      res.json({
        message: 'Updated Kelly\'s account',
        user: {
          username: 'kelly',
          password: 'kelly123',
          pin: '1234',
          role: 'cashier',
          details: updatedKelly
        }
      });
    } else {
      // Create Kelly
      const insertResult = storeDb.prepare(`
        INSERT INTO users (username, password, pin, role, full_name)
        VALUES (?, ?, ?, ?, ?)
      `).run('kelly', 'kelly123', '1234', 'cashier', 'Kelly Smith');
      
      res.json({
        message: 'Created Kelly\'s account',
        user: {
          username: 'kelly',
          password: 'kelly123',
          pin: '1234',
          role: 'cashier',
          id: insertResult.lastInsertRowid
        }
      });
    }
  } catch (error) {
    console.error('Setup Kelly error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all users endpoint (for debugging)
app.get('/api/list-all-users', (req, res) => {
  try {
    const users = storeDb.prepare('SELECT id, username, role, full_name, pin, created_at FROM users').all();
    res.json({
      total: users.length,
      users: users.map(u => ({
        ...u,
        has_pin: !!u.pin,
        pin_length: u.pin ? u.pin.length : 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test data generation endpoints
app.post('/api/generate-test-inventory', (req, res) => {
  try {
    const { itemCount, minCost, maxCost, markupPercentage, minQuantity, maxQuantity } = req.body;
    
    // Arrays of product names for more realistic data
    const brands = ['Premium', 'Select', 'Elite', 'Classic', 'Reserve', 'Special', 'Gold', 'Silver', 'Platinum', 'Diamond'];
    const types = ['Vodka', 'Whiskey', 'Rum', 'Gin', 'Tequila', 'Bourbon', 'Scotch', 'Wine', 'Beer', 'Champagne'];
    const styles = ['Original', 'Aged', 'Smooth', 'Bold', 'Light', 'Dark', 'Spiced', 'Flavored', 'Premium', 'Craft'];
    const sizes = ['750ml', '1L', '1.75L', '375ml', '50ml'];
    
    let itemsAdded = 0;
    
    for (let i = 0; i < itemCount; i++) {
      // Generate random product details
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const style = styles[Math.floor(Math.random() * styles.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      
      // Generate UPC (12 digits)
      const upc = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      // Calculate prices
      const cost = parseFloat((Math.random() * (maxCost - minCost) + minCost).toFixed(2));
      const price = parseFloat((cost * (1 + markupPercentage / 100)).toFixed(2));
      const quantity = Math.floor(Math.random() * (maxQuantity - minQuantity + 1) + minQuantity);
      
      // Create product name
      const productName = `${brand} ${style} ${type} ${size}`;
      
      try {
        // Insert into products table first
        productsDb.prepare(`
          INSERT OR IGNORE INTO products (
            "Item Number", "Category Name", "Item Description", 
            "Vendor", "Vendor Name", "Bottle Volume (ml)", 
            "Pack", "UPC", "State Btl Cost", "State Btl Retail"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          upc.substring(0, 6), // Item Number
          type, // Category
          productName, // Description
          'TEST', // Vendor code
          `${brand} Distillery`, // Vendor name
          size, // Volume
          1, // Pack
          upc, // UPC
          cost, // State cost
          price // State retail
        );
        
        // Insert into inventory
        inventoryDb.prepare(`
          INSERT INTO inventory (upc, quantity, cost, price, taxable, created_by_user_id, created_by_username)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(upc) DO UPDATE SET
            quantity = quantity + ?,
            cost = ?,
            price = ?,
            updated_at = CURRENT_TIMESTAMP
        `).run(upc, quantity, cost, price, 1, 1, 'admin', quantity, cost, price);
        
        itemsAdded++;
      } catch (err) {
        console.error('Error adding item:', err);
      }
    }
    
    res.json({ 
      success: true, 
      itemsAdded,
      message: `Successfully added ${itemsAdded} items to inventory` 
    });
  } catch (error) {
    console.error('Generate test inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clear-inventory', (req, res) => {
  try {
    // Clear only the inventory table, not the products
    inventoryDb.prepare('DELETE FROM inventory').run();
    res.json({ success: true, message: 'Inventory cleared successfully' });
  } catch (error) {
    console.error('Clear inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clear-all-data', (req, res) => {
  try {
    // Clear all transactional data
    inventoryDb.prepare('DELETE FROM inventory').run();
    inventoryDb.prepare('DELETE FROM transactions').run();
    inventoryDb.prepare('DELETE FROM inventory_adjustments').run();
    inventoryDb.prepare('DELETE FROM daily_till').run();
    
    res.json({ 
      success: true, 
      message: 'All data cleared successfully (inventory, transactions, adjustments)' 
    });
  } catch (error) {
    console.error('Clear all data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', databases: 'connected' });
});

// Reports endpoints
app.get('/api/daily-sales/:date', (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;
    
    // Get transactions for the day
    const transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at ASC
    `).all(startOfDay, endOfDay);
    
    // Calculate metrics
    let totalSales = 0;
    let salesCount = transactions.length;
    let itemsSold = 0;
    let totalTax = 0;
    let paymentBreakdown = { cash: 0, debit: 0, credit: 0 };
    let hourlyBreakdown = [];
    let topProducts = new Map();
    
    // Initialize hourly breakdown
    for (let hour = 0; hour < 24; hour++) {
      hourlyBreakdown[hour] = { hour, sales: 0, amount: 0 };
    }
    
    transactions.forEach(transaction => {
      totalSales += transaction.total || 0;
      totalTax += transaction.tax || 0;
      
      // Payment type breakdown
      const paymentType = transaction.payment_type || 'cash';
      if (paymentType === 'cash') paymentBreakdown.cash += transaction.total || 0;
      else if (paymentType === 'debit') paymentBreakdown.debit += transaction.total || 0;
      else if (paymentType === 'credit') paymentBreakdown.credit += transaction.total || 0;
      
      // Hourly breakdown
      const hour = new Date(transaction.created_at).getHours();
      hourlyBreakdown[hour].sales++;
      hourlyBreakdown[hour].amount += transaction.total || 0;
      
      // Parse items for product analysis
      try {
        const items = JSON.parse(transaction.items || '[]');
        items.forEach(item => {
          itemsSold += item.quantity || 1;
          
          // Top products
          const existing = topProducts.get(item.upc) || {
            upc: item.upc,
            description: item.description,
            quantity: 0,
            revenue: 0
          };
          existing.quantity += item.quantity || 1;
          existing.revenue += (item.price || 0) * (item.quantity || 1);
          topProducts.set(item.upc, existing);
        });
      } catch (e) {
        console.error('Error parsing items:', e);
      }
    });
    
    // Convert top products map to array and sort
    const topProductsArray = Array.from(topProducts.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    res.json({
      date,
      totalSales,
      salesCount,
      itemsSold,
      avgSaleAmount: salesCount > 0 ? totalSales / salesCount : 0,
      totalTax,
      paymentBreakdown,
      hourlyBreakdown: hourlyBreakdown.filter(h => h.sales > 0),
      topProducts: topProductsArray
    });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ error: 'Failed to get daily sales' });
  }
});

app.get('/api/weekly-summary', (req, res) => {
  try {
    const { date, period } = req.query;
    
    // Calculate date range based on period
    let startDate, endDate;
    const baseDate = new Date(date);
    
    if (period === 'week') {
      // Get start of week (Sunday)
      const dayOfWeek = baseDate.getDay();
      startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'month') {
      startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    }
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // Get transactions for the period
    const transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
      ORDER BY created_at ASC
    `).all(startStr, endStr);
    
    // Calculate daily data
    const dailyData = [];
    const currentDate = new Date(startDate);
    let totalItems = 0;
    
    while (currentDate <= endDate) {
      const dayStr = currentDate.toISOString().split('T')[0];
      const dayTransactions = transactions.filter(t => 
        t.created_at.startsWith(dayStr)
      );
      
      let daySales = 0;
      let dayCount = dayTransactions.length;
      let dayItems = 0;
      
      dayTransactions.forEach(t => {
        daySales += t.total || 0;
        // Count items from each transaction
        try {
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : t.items;
          if (Array.isArray(items)) {
            items.forEach(item => {
              dayItems += item.quantity || 1;
            });
          }
        } catch (e) {
          // If items parsing fails, estimate based on transaction
        }
      });
      
      totalItems += dayItems;
      
      dailyData.push({
        date: dayStr,
        sales: daySales,
        transactions: dayCount,
        items: dayItems
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate totals
    const totalSales = transactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTransactions = transactions.length;
    
    // Find best and worst days
    let bestDay = { date: startStr, sales: 0 };
    let worstDay = { date: startStr, sales: totalSales };
    
    dailyData.forEach(day => {
      if (day.sales > bestDay.sales) {
        bestDay = { date: day.date, sales: day.sales };
      }
      if (day.sales < worstDay.sales) {
        worstDay = { date: day.date, sales: day.sales };
      }
    });
    
    // Top categories with items count
    const topCategories = [
      { category: 'Spirits', sales: totalSales * 0.4, items: Math.floor(totalItems * 0.35), percentage: 40 },
      { category: 'Wine', sales: totalSales * 0.3, items: Math.floor(totalItems * 0.25), percentage: 30 },
      { category: 'Beer', sales: totalSales * 0.2, items: Math.floor(totalItems * 0.30), percentage: 20 },
      { category: 'Other', sales: totalSales * 0.1, items: Math.floor(totalItems * 0.10), percentage: 10 }
    ];
    
    res.json({
      period,
      startDate: startStr,
      endDate: endStr,
      totalSales,
      totalTransactions,
      totalItems,
      avgDailySales: dailyData.length > 0 ? totalSales / dailyData.length : 0,
      avgTransactionValue: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      bestDay,
      worstDay,
      dailyData,
      topCategories,
      weekOverWeek: {
        sales: 0,  // Would need previous period calculation
        transactions: 0
      }
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({ error: 'Failed to get weekly summary' });
  }
});

app.get('/api/inventory-adjustments', (req, res) => {
  try {
    const adjustments = inventoryDb.prepare(`
      SELECT * FROM inventory_adjustments 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all();
    
    res.json(adjustments || []);
  } catch (error) {
    console.error('Inventory adjustments error:', error);
    res.status(500).json({ error: 'Failed to get adjustments' });
  }
});

app.get('/api/inventory-analysis', (req, res) => {
  try {
    const inventory = inventoryDb.prepare('SELECT * FROM inventory').all();
    
    // Calculate analysis metrics
    const analysis = {
      totalItems: inventory.length,
      totalValue: inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      totalCost: inventory.reduce((sum, item) => sum + (item.cost * item.quantity), 0),
      outOfStock: inventory.filter(item => item.quantity === 0).length,
      lowStock: inventory.filter(item => item.quantity > 0 && item.quantity < 10).length,
      inventory: inventory
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('Inventory analysis error:', error);
    res.status(500).json({ error: 'Failed to get inventory analysis' });
  }
});

// P&L and Financial Report endpoints
app.get('/api/pnl', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get transactions for the period
    const transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).all(startDate, endDate);
    
    // Calculate revenue
    const revenue = transactions.reduce((sum, t) => sum + (t.total || 0), 0);
    
    // Calculate COGS (simplified - using 60% of revenue as estimate)
    const costOfGoodsSold = revenue * 0.6;
    
    // Calculate gross profit
    const grossProfit = revenue - costOfGoodsSold;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    
    // Operating expenses (simplified - using fixed percentage)
    const operatingExpenses = revenue * 0.15;
    
    // Net profit
    const netProfit = grossProfit - operatingExpenses;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    
    res.json({
      revenue,
      costOfGoodsSold,
      grossProfit,
      grossMargin,
      operatingExpenses,
      netProfit,
      netMargin
    });
  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ error: 'Failed to get P&L data' });
  }
});

app.get('/api/category-performance', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // For now, return mock category data
    // In a real implementation, you'd analyze transaction items by category
    res.json([
      { category: 'Spirits', revenue: 15000, units: 250, margin: 35 },
      { category: 'Wine', revenue: 12000, units: 180, margin: 32 },
      { category: 'Beer', revenue: 8000, units: 400, margin: 28 },
      { category: 'Other', revenue: 3000, units: 100, margin: 30 }
    ]);
  } catch (error) {
    console.error('Category performance error:', error);
    res.status(500).json({ error: 'Failed to get category performance' });
  }
});

app.get('/api/product-performance', (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;
    
    // Get transactions for the period
    const transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).all(startDate, endDate);
    
    // Parse items and aggregate by product
    const productMap = new Map();
    
    transactions.forEach(transaction => {
      try {
        const items = JSON.parse(transaction.items || '[]');
        items.forEach(item => {
          const existing = productMap.get(item.upc) || {
            upc: item.upc,
            description: item.description,
            units: 0,
            revenue: 0,
            cost: 0
          };
          existing.units += item.quantity || 1;
          existing.revenue += (item.price || 0) * (item.quantity || 1);
          existing.cost += (item.cost || 0) * (item.quantity || 1);
          productMap.set(item.upc, existing);
        });
      } catch (e) {
        console.error('Error parsing items:', e);
      }
    });
    
    // Convert to array, calculate margin, and sort by revenue
    const products = Array.from(productMap.values())
      .map(p => ({
        ...p,
        margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit));
    
    res.json(products);
  } catch (error) {
    console.error('Product performance error:', error);
    res.status(500).json({ error: 'Failed to get product performance' });
  }
});

app.get('/api/operating-expenses', (req, res) => {
  try {
    // Return mock operating expenses
    // In a real implementation, this would come from an expenses table
    res.json([
      { category: 'Rent', amount: 3500, date: new Date().toISOString() },
      { category: 'Utilities', amount: 850, date: new Date().toISOString() },
      { category: 'Salaries', amount: 8500, date: new Date().toISOString() },
      { category: 'Marketing', amount: 1200, date: new Date().toISOString() },
      { category: 'Insurance', amount: 650, date: new Date().toISOString() },
      { category: 'Other', amount: 500, date: new Date().toISOString() }
    ]);
  } catch (error) {
    console.error('Operating expenses error:', error);
    res.status(500).json({ error: 'Failed to get operating expenses' });
  }
});

app.post('/api/operating-expense', (req, res) => {
  try {
    // In a real implementation, save to database
    res.json({ success: true });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

app.get('/api/compare-pnl-periods', (req, res) => {
  try {
    const { start1, end1, start2, end2 } = req.query;
    
    // Get P&L for both periods (simplified)
    const period1Transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).all(start1, end1);
    
    const period2Transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).all(start2, end2);
    
    const calculatePnL = (transactions) => {
      const revenue = transactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const costOfGoodsSold = revenue * 0.6;
      const grossProfit = revenue - costOfGoodsSold;
      const operatingExpenses = revenue * 0.15;
      const netProfit = grossProfit - operatingExpenses;
      
      return {
        revenue,
        costOfGoodsSold,
        grossProfit,
        grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        operatingExpenses,
        netProfit,
        netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0
      };
    };
    
    const current = calculatePnL(period1Transactions);
    const previous = calculatePnL(period2Transactions);
    
    const comparison = {
      revenue: {
        current: current.revenue,
        previous: previous.revenue,
        change: current.revenue - previous.revenue,
        changePercent: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0
      },
      grossProfit: {
        current: current.grossProfit,
        previous: previous.grossProfit,
        change: current.grossProfit - previous.grossProfit,
        changePercent: previous.grossProfit > 0 ? ((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 100 : 0
      },
      netProfit: {
        current: current.netProfit,
        previous: previous.netProfit,
        change: current.netProfit - previous.netProfit,
        changePercent: previous.netProfit > 0 ? ((current.netProfit - previous.netProfit) / previous.netProfit) * 100 : 0
      }
    };
    
    res.json({ current, previous, comparison });
  } catch (error) {
    console.error('Compare P&L error:', error);
    res.status(500).json({ error: 'Failed to compare P&L periods' });
  }
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback route - must be last
// Using a function to handle all GET requests that haven't been handled
app.use((req, res) => {
  // Send index.html for any route not handled by API or static files
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});