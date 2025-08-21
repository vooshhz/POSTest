// server-complete.js - Complete server with all API endpoints for Fly.io deployment
import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Session management (simple in-memory for now)
const sessions = new Map();

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
      description TEXT,
      quantity INTEGER DEFAULT 0,
      cost REAL,
      price REAL,
      category TEXT,
      taxable INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add missing columns if they don't exist
  try {
    inventoryDb.exec(`ALTER TABLE inventory ADD COLUMN description TEXT`);
    console.log('Added description column to inventory');
  } catch (e) {
    // Column already exists or other error
  }
  
  try {
    inventoryDb.exec(`ALTER TABLE inventory ADD COLUMN category TEXT`);
    console.log('Added category column to inventory');
  } catch (e) {
    // Column already exists or other error
  }

  // Ensure transactions table exists
  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      payment_type TEXT NOT NULL,
      cash_given REAL,
      change_given REAL,
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

  // Ensure till tables exist
  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS till_settings (
      id INTEGER PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      starting_cash REAL DEFAULT 0,
      ones INTEGER DEFAULT 0,
      fives INTEGER DEFAULT 0,
      tens INTEGER DEFAULT 0,
      twenties INTEGER DEFAULT 0,
      fifties INTEGER DEFAULT 0,
      hundreds INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  inventoryDb.exec(`
    CREATE TABLE IF NOT EXISTS daily_till (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      starting_cash REAL NOT NULL,
      current_cash REAL NOT NULL,
      cash_sales REAL DEFAULT 0,
      cash_returns REAL DEFAULT 0,
      cash_drops REAL DEFAULT 0,
      expected_cash REAL,
      actual_cash REAL,
      difference REAL,
      closed_at DATETIME,
      closed_by_user_id INTEGER,
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
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      created_by INTEGER
    )
  `);

  // Ensure store_info table exists
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

  // Ensure user_activity table exists
  storeDb.exec(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure time_clock table exists
  storeDb.exec(`
    CREATE TABLE IF NOT EXISTS time_clock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      punch_in DATETIME NOT NULL,
      punch_out DATETIME,
      shift_date DATE NOT NULL,
      duration_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin if no users exist
  const userCount = storeDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    storeDb.prepare(`
      INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)
    `).run('admin', 'admin123', 'admin', 'Administrator');
    console.log('Created default admin user (admin/admin123)');
  }

  // Create default till settings if none exist
  const tillSettings = inventoryDb.prepare('SELECT * FROM till_settings WHERE id = 1').get();
  if (!tillSettings) {
    inventoryDb.prepare(`
      INSERT INTO till_settings (id, enabled, starting_cash) VALUES (1, 0, 0)
    `).run();
  }

  console.log('Database tables initialized');
}

initTables();

// Helper function to log user activity
function logUserActivity(userId, action, details = null) {
  try {
    storeDb.prepare(`
      INSERT INTO user_activity (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(userId, action, details);
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
}

// ==================== API ROUTES ====================

// Product search
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
      OR "Category Name" LIKE ?
      LIMIT 50
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);
    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Inventory management
app.get('/api/inventory', (req, res) => {
  try {
    const inventory = inventoryDb.prepare(`
      SELECT * FROM inventory ORDER BY COALESCE(description, upc)
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
    const { upc, name, description, quantity, cost, price, category, taxable } = req.body;
    const itemDescription = description || name; // Use description if provided, otherwise use name
    
    // Check if item exists
    const existing = inventoryDb.prepare('SELECT * FROM inventory WHERE upc = ?').get(upc);
    
    if (existing) {
      // Update existing item
      inventoryDb.prepare(`
        UPDATE inventory SET
          quantity = quantity + ?,
          cost = ?,
          price = ?,
          category = COALESCE(?, category),
          taxable = COALESCE(?, taxable),
          updated_at = CURRENT_TIMESTAMP
        WHERE upc = ?
      `).run(quantity, cost, price, category, taxable, upc);
      
      res.json({ success: true, message: 'Inventory updated', updated: true });
    } else {
      // Insert new item
      inventoryDb.prepare(`
        INSERT INTO inventory (upc, description, quantity, cost, price, category, taxable)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(upc, itemDescription, quantity, cost, price, category, taxable !== undefined ? taxable : 1);
      
      res.json({ success: true, message: 'Item added to inventory' });
    }
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
      inventoryDb.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE upc = ?').run(newQuantity, upc);
      
      inventoryDb.prepare(`
        INSERT INTO inventory_adjustments 
        (upc, adjustment_type, quantity_change, quantity_before, quantity_after, created_by_user_id, created_by_username, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(upc, reason || 'manual', change, current.quantity, newQuantity, userId, username, reason);
    });
    
    transaction();
    res.json({ success: true });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/inventory-adjustments', (req, res) => {
  try {
    const { upc, type, startDate, endDate } = req.query;
    let query = 'SELECT * FROM inventory_adjustments WHERE 1=1';
    const params = [];
    
    if (upc) {
      query += ' AND upc = ?';
      params.push(upc);
    }
    if (type) {
      query += ' AND adjustment_type = ?';
      params.push(type);
    }
    if (startDate && endDate) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    const adjustments = inventoryDb.prepare(query).all(...params);
    res.json(adjustments);
  } catch (error) {
    console.error('Get adjustments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transaction management
app.post('/api/create-transaction', (req, res) => {
  try {
    const { items, subtotal, tax, total, paymentType, cashGiven, changeGiven, userId, username } = req.body;
    
    const transaction = inventoryDb.transaction(() => {
      // Save transaction
      const result = inventoryDb.prepare(`
        INSERT INTO transactions (items, subtotal, tax, total, payment_type, cash_given, change_given, created_by_user_id, created_by_username)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        JSON.stringify(items),
        subtotal,
        tax,
        total,
        paymentType,
        cashGiven || null,
        changeGiven || null,
        userId,
        username
      );
      
      // Update inventory quantities
      for (const item of items) {
        const current = inventoryDb.prepare('SELECT quantity FROM inventory WHERE upc = ?').get(item.upc);
        if (current) {
          const newQuantity = current.quantity - item.quantity;
          inventoryDb.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE upc = ?').run(newQuantity, item.upc);
          
          // Log adjustment
          inventoryDb.prepare(`
            INSERT INTO inventory_adjustments 
            (upc, adjustment_type, quantity_change, quantity_before, quantity_after, created_by_user_id, created_by_username, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.upc, 'sale', -item.quantity, current.quantity, newQuantity, userId, username, `Transaction #${result.lastInsertRowid}`);
        }
      }
      
      // Update till if cash payment
      if (paymentType === 'cash') {
        const today = new Date().toISOString().split('T')[0];
        const till = inventoryDb.prepare('SELECT * FROM daily_till WHERE date = ?').get(today);
        if (till) {
          inventoryDb.prepare(`
            UPDATE daily_till SET 
              current_cash = current_cash + ?,
              cash_sales = cash_sales + ?
            WHERE date = ?
          `).run(total, total, today);
        }
      }
      
      return result.lastInsertRowid;
    });
    
    const transactionId = transaction();
    res.json({ success: true, id: transactionId });
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
    
    // Parse items JSON for each transaction
    const parsed = transactions.map(t => ({
      ...t,
      items: JSON.parse(t.items)
    }));
    
    res.json(parsed);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// User management
app.post('/api/check-user-type', (req, res) => {
  try {
    const { username } = req.body;
    const user = storeDb.prepare(`
      SELECT id, username, role FROM users WHERE username = ? AND active = 1
    `).get(username);
    
    if (user) {
      res.json({
        success: true,
        role: user.role,
        requiresPin: user.role === 'cashier',
        requiresPassword: user.role !== 'cashier'
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

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check both password and PIN fields
    const user = storeDb.prepare(`
      SELECT * FROM users 
      WHERE username = ? 
      AND (password = ? OR pin = ?)
      AND active = 1
    `).get(username, password, password);
    
    if (user) {
      // Update last login
      storeDb.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
      
      // Log activity
      logUserActivity(user.id, 'login', 'User logged in');
      
      // Create session
      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, {
        userId: user.id,
        username: user.username,
        role: user.role,
        loginTime: Date.now()
      });
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.full_name
        },
        sessionId
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    if (sessionId) {
      sessions.delete(sessionId);
    }
    
    if (userId) {
      logUserActivity(userId, 'logout', 'User logged out');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = storeDb.prepare('SELECT id, username, role, full_name, active FROM users').all();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
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

app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    storeDb.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Store management
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

// Till management
app.get('/api/till-settings', (req, res) => {
  try {
    const settings = inventoryDb.prepare('SELECT * FROM till_settings WHERE id = 1').get();
    res.json(settings || { enabled: false });
  } catch (error) {
    console.error('Get till settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/till-settings', (req, res) => {
  try {
    const settings = req.body;
    
    inventoryDb.prepare(`
      UPDATE till_settings SET
        enabled = ?,
        starting_cash = ?,
        ones = ?,
        fives = ?,
        tens = ?,
        twenties = ?,
        fifties = ?,
        hundreds = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      settings.enabled ? 1 : 0,
      settings.starting_cash || 0,
      settings.ones || 0,
      settings.fives || 0,
      settings.tens || 0,
      settings.twenties || 0,
      settings.fifties || 0,
      settings.hundreds || 0
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save till settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/current-till', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const till = inventoryDb.prepare('SELECT * FROM daily_till WHERE date = ?').get(today);
    res.json(till || null);
  } catch (error) {
    console.error('Get current till error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/initialize-till', (req, res) => {
  try {
    const { denominations } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const startingCash = 
      (denominations.ones || 0) * 1 +
      (denominations.fives || 0) * 5 +
      (denominations.tens || 0) * 10 +
      (denominations.twenties || 0) * 20 +
      (denominations.fifties || 0) * 50 +
      (denominations.hundreds || 0) * 100;
    
    // Check if till for today already exists
    const existing = inventoryDb.prepare('SELECT id FROM daily_till WHERE date = ?').get(today);
    
    if (existing) {
      inventoryDb.prepare(`
        UPDATE daily_till SET
          starting_cash = ?,
          current_cash = ?,
          cash_sales = 0,
          cash_returns = 0,
          cash_drops = 0
        WHERE date = ?
      `).run(startingCash, startingCash, today);
    } else {
      inventoryDb.prepare(`
        INSERT INTO daily_till (date, starting_cash, current_cash)
        VALUES (?, ?, ?)
      `).run(today, startingCash, startingCash);
    }
    
    res.json({ 
      success: true,
      data: {
        date: today,
        startingCash,
        currentCash: startingCash
      }
    });
  } catch (error) {
    console.error('Initialize till error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/close-till', (req, res) => {
  try {
    const { actualCash, userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const till = inventoryDb.prepare('SELECT * FROM daily_till WHERE date = ?').get(today);
    
    if (!till) {
      res.status(400).json({ success: false, error: 'No till found for today' });
      return;
    }
    
    const expectedCash = till.current_cash;
    const difference = actualCash - expectedCash;
    
    inventoryDb.prepare(`
      UPDATE daily_till SET
        actual_cash = ?,
        expected_cash = ?,
        difference = ?,
        closed_at = CURRENT_TIMESTAMP,
        closed_by_user_id = ?
      WHERE date = ?
    `).run(actualCash, expectedCash, difference, userId, today);
    
    res.json({ 
      success: true,
      data: {
        expectedCash,
        actualCash,
        difference
      }
    });
  } catch (error) {
    console.error('Close till error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Time clock
app.get('/api/current-shift/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const shift = storeDb.prepare(`
      SELECT * FROM time_clock 
      WHERE user_id = ? AND punch_out IS NULL
      ORDER BY punch_in DESC LIMIT 1
    `).get(userId);
    res.json(shift || null);
  } catch (error) {
    console.error('Get current shift error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/punch-in', (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already punched in
    const existing = storeDb.prepare(`
      SELECT id FROM time_clock 
      WHERE user_id = ? AND punch_out IS NULL
    `).get(userId);
    
    if (existing) {
      res.status(400).json({ success: false, error: 'Already punched in' });
      return;
    }
    
    const result = storeDb.prepare(`
      INSERT INTO time_clock (user_id, punch_in, shift_date)
      VALUES (?, CURRENT_TIMESTAMP, ?)
    `).run(userId, today);
    
    logUserActivity(userId, 'punch_in', 'Punched in for shift');
    
    res.json({ success: true, shiftId: result.lastInsertRowid });
  } catch (error) {
    console.error('Punch in error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/punch-out', (req, res) => {
  try {
    const { userId } = req.body;
    
    const shift = storeDb.prepare(`
      SELECT id, punch_in FROM time_clock 
      WHERE user_id = ? AND punch_out IS NULL
      ORDER BY punch_in DESC LIMIT 1
    `).get(userId);
    
    if (!shift) {
      res.status(400).json({ success: false, error: 'No active shift found' });
      return;
    }
    
    const punchOut = new Date();
    const punchIn = new Date(shift.punch_in);
    const durationMinutes = Math.floor((punchOut - punchIn) / 60000);
    
    storeDb.prepare(`
      UPDATE time_clock SET
        punch_out = CURRENT_TIMESTAMP,
        duration_minutes = ?
      WHERE id = ?
    `).run(durationMinutes, shift.id);
    
    logUserActivity(userId, 'punch_out', `Punched out after ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`);
    
    res.json({ success: true, duration: durationMinutes });
  } catch (error) {
    console.error('Punch out error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Inventory transactions endpoint
app.get('/api/inventory-transactions', (req, res) => {
  try {
    const transactions = inventoryDb.prepare(`
      SELECT 
        t.id as transaction_id,
        t.created_at,
        t.items,
        t.total as transaction_total,
        t.payment_type,
        t.created_by_username
      FROM transactions t
      ORDER BY t.created_at DESC
      LIMIT 500
    `).all();
    
    // Parse items for each transaction
    const result = [];
    transactions.forEach(trans => {
      try {
        const items = JSON.parse(trans.items);
        items.forEach(item => {
          result.push({
            transaction_id: trans.transaction_id,
            created_at: trans.created_at,
            upc: item.upc,
            description: item.description || item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            payment_type: trans.payment_type,
            transaction_total: trans.transaction_total,
            created_by: trans.created_by_username
          });
        });
      } catch (e) {
        console.error('Failed to parse transaction items:', e);
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('Get inventory transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reporting endpoints
app.get('/api/daily-sales/:date', (req, res) => {
  try {
    const { date } = req.params;
    
    const transactions = inventoryDb.prepare(`
      SELECT * FROM transactions 
      WHERE DATE(created_at) = DATE(?)
    `).all(date);
    
    let totalSales = 0;
    let totalTax = 0;
    let itemsSold = 0;
    const paymentBreakdown = { cash: 0, debit: 0, credit: 0 };
    
    transactions.forEach(t => {
      totalSales += t.total;
      totalTax += t.tax;
      
      try {
        const items = JSON.parse(t.items);
        if (Array.isArray(items)) {
          itemsSold += items.reduce((sum, item) => sum + item.quantity, 0);
        }
      } catch (e) {
        console.error('Failed to parse items:', e);
      }
      
      if (t.payment_type === 'cash') paymentBreakdown.cash += t.total;
      if (t.payment_type === 'debit') paymentBreakdown.debit += t.total;
      if (t.payment_type === 'credit') paymentBreakdown.credit += t.total;
    });
    
    res.json({
      date,
      totalSales,
      salesCount: transactions.length,
      itemsSold,
      avgSaleAmount: transactions.length > 0 ? totalSales / transactions.length : 0,
      totalTax,
      paymentBreakdown
    });
  } catch (error) {
    console.error('Get daily sales error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory-analysis', (req, res) => {
  try {
    const inventory = inventoryDb.prepare('SELECT * FROM inventory').all();
    
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCost = inventory.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    
    const stockLevels = {
      critical: inventory.filter(i => i.quantity === 0).length,
      low: inventory.filter(i => i.quantity > 0 && i.quantity < 10).length,
      normal: inventory.filter(i => i.quantity >= 10 && i.quantity <= 50).length,
      high: inventory.filter(i => i.quantity > 50 && i.quantity <= 100).length,
      excess: inventory.filter(i => i.quantity > 100).length
    };
    
    res.json({
      metrics: {
        totalItems: inventory.length,
        totalQuantity,
        totalValue,
        totalCost,
        avgMargin: totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0,
        lowStockItems: stockLevels.low + stockLevels.critical,
        overstockItems: stockLevels.excess,
        stockLevels
      },
      items: inventory
    });
  } catch (error) {
    console.error('Get inventory analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', databases: 'connected' });
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback route - must be last
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log('API endpoints ready:');
  console.log('  - Product search');
  console.log('  - Inventory management');
  console.log('  - Transaction processing');
  console.log('  - User authentication');
  console.log('  - Till management');
  console.log('  - Reporting');
});