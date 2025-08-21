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
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      cost REAL,
      price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    const inventory = inventoryDb.prepare(`
      SELECT * FROM inventory
    `).all();
    res.json(inventory);
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
    res.json(item || null);
  } catch (error) {
    console.error('Check inventory error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/add-to-inventory', (req, res) => {
  try {
    const { upc, name, quantity, cost, price } = req.body;
    inventoryDb.prepare(`
      INSERT INTO inventory (upc, name, quantity, cost, price)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(upc) DO UPDATE SET
        quantity = quantity + ?,
        cost = ?,
        price = ?,
        updated_at = CURRENT_TIMESTAMP
    `).run(upc, name, quantity, cost, price, quantity, cost, price);
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
    res.json(transactions);
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

app.get('/api/users', (req, res) => {
  try {
    const users = storeDb.prepare('SELECT id, username, role FROM users').all();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', databases: 'connected' });
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