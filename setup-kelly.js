// Script to set up Kelly user in the database
const Database = require('better-sqlite3');
const path = require('path');

// Connect to the database
const dbPath = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'StoreInformation.db') : './StoreInformation.db';
console.log('Connecting to database at:', dbPath);

const db = new Database(dbPath);

// Check if Kelly exists
const existingKelly = db.prepare('SELECT * FROM users WHERE username = ?').get('kelly');

if (existingKelly) {
  console.log('Kelly already exists:', existingKelly);
  
  // Update Kelly's PIN and password
  const updateResult = db.prepare(`
    UPDATE users 
    SET password = ?, pin = ?, role = ?, full_name = ?
    WHERE username = ?
  `).run('kelly123', '1234', 'cashier', 'Kelly Smith', 'kelly');
  
  console.log('Updated Kelly\'s account');
  console.log('Username: kelly');
  console.log('Password: kelly123');
  console.log('PIN: 1234');
  console.log('Role: cashier');
} else {
  // Create Kelly
  const insertResult = db.prepare(`
    INSERT INTO users (username, password, pin, role, full_name)
    VALUES (?, ?, ?, ?, ?)
  `).run('kelly', 'kelly123', '1234', 'cashier', 'Kelly Smith');
  
  console.log('Created Kelly\'s account');
  console.log('Username: kelly');
  console.log('Password: kelly123');
  console.log('PIN: 1234');
  console.log('Role: cashier');
}

// List all users
console.log('\nAll users in database:');
const allUsers = db.prepare('SELECT id, username, role, full_name, pin FROM users').all();
allUsers.forEach(user => {
  console.log(`- ${user.username} (${user.role}) - PIN: ${user.pin || 'not set'}`);
});

db.close();
console.log('\nSetup complete!');