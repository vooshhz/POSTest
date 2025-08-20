/**
 * Web-compatible API layer that wraps window.api calls
 * Provides fallback implementations for web environments
 */

// Type imports from preload
type InventoryAPI = typeof window.api;

// Check if running in Electron environment
const isElectron = () => {
  return typeof window !== 'undefined' && window.api !== undefined;
};

// Mock data storage for web fallbacks
class WebStorage {
  private static instance: WebStorage;
  private inventory: Map<string, any> = new Map();
  private transactions: any[] = [];
  private users: Map<number, any> = new Map();
  private storeInfo: any = null;
  private tillSettings: any = null;
  private currentTill: any = null;
  private currentUser: any = null;
  private adjustments: any[] = [];
  private timeClockEntries: any[] = [];
  
 private constructor() {
  this.loadFromLocalStorage();
  this.initializeDefaultData();
}
  
  static getInstance(): WebStorage {
    if (!WebStorage.instance) {
      WebStorage.instance = new WebStorage();
    }
    return WebStorage.instance;
  }
  
  private loadFromLocalStorage() {
    try {
      const savedData = localStorage.getItem('posWebData');
      if (savedData) {
        const data = JSON.parse(savedData);
        this.inventory = new Map(data.inventory || []);
        this.transactions = data.transactions || [];
        this.users = new Map(data.users || []);
        this.storeInfo = data.storeInfo || null;
        this.tillSettings = data.tillSettings || null;
        this.currentTill = data.currentTill || null;
        this.adjustments = data.adjustments || [];
        this.timeClockEntries = data.timeClockEntries || [];
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }
  
  private saveToLocalStorage() {
    try {
      const data = {
        inventory: Array.from(this.inventory.entries()),
        transactions: this.transactions,
        users: Array.from(this.users.entries()),
        storeInfo: this.storeInfo,
        tillSettings: this.tillSettings,
        currentTill: this.currentTill,
        adjustments: this.adjustments,
        timeClockEntries: this.timeClockEntries
      };
      localStorage.setItem('posWebData', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private initializeDefaultData() {
  // Add default users if none exist
  if (this.users.size === 0) {
    const defaultUsers = [
      {
        id: 1,
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        full_name: 'Admin User',
        active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        username: 'demo',
        password: 'demo123',
        role: 'cashier',
        pin: '1234',
        full_name: 'Demo User',
        active: 1,
        created_at: new Date().toISOString()
      }
    ];
    
    defaultUsers.forEach(user => {
      this.users.set(user.id, user);
    });
    
    // Also set default store info if none exists
    if (!this.storeInfo) {
      this.storeInfo = {
        store_name: 'Demo POS Store',
        store_address: '123 Demo Street',
        store_phone: '555-0100',
        tax_rate: 0.08
      };
    }
    
    // Save the defaults
    this.saveToLocalStorage();
  }
}
  
  // Inventory methods
  getInventoryItem(upc: string) {
    return this.inventory.get(upc);
  }
  
  setInventoryItem(upc: string, item: any) {
    this.inventory.set(upc, item);
    this.saveToLocalStorage();
  }
  
  getAllInventory() {
    return Array.from(this.inventory.values());
  }
  
  clearInventory() {
    this.inventory.clear();
    this.saveToLocalStorage();
  }
  
  // Transaction methods
  addTransaction(transaction: any) {
    const id = this.transactions.length + 1;
    const newTransaction = { ...transaction, id, created_at: new Date().toISOString() };
    this.transactions.push(newTransaction);
    this.saveToLocalStorage();
    return id;
  }
  
  getTransactions() {
    return this.transactions;
  }
  
  clearTransactions() {
    this.transactions = [];
    this.saveToLocalStorage();
  }
  
  // User methods
  addUser(user: any) {
    const id = this.users.size + 1;
    const newUser = { ...user, id, created_at: new Date().toISOString() };
    this.users.set(id, newUser);
    this.saveToLocalStorage();
    return id;
  }
  
  getUser(id: number) {
    return this.users.get(id);
  }
  
  getAllUsers() {
    return Array.from(this.users.values());
  }
  
  removeUser(id: number) {
    this.users.delete(id);
    this.saveToLocalStorage();
  }
  
  setCurrentUser(user: any) {
    this.currentUser = user;
    this.saveToLocalStorage();
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
  
  // Store info methods
  getStoreInfo() {
    return this.storeInfo;
  }
  
  setStoreInfo(info: any) {
    this.storeInfo = info;
    this.saveToLocalStorage();
  }
  
  // Till methods
  getTillSettings() {
    return this.tillSettings || {
      enabled: false,
      denominations: {
        ones: 0,
        fives: 0,
        tens: 0,
        twenties: 0,
        fifties: 0,
        hundreds: 0
      }
    };
  }
  
  setTillSettings(settings: any) {
    this.tillSettings = settings;
    this.saveToLocalStorage();
  }
  
  getCurrentTill() {
    return this.currentTill;
  }
  
  setCurrentTill(till: any) {
    this.currentTill = till;
    this.saveToLocalStorage();
  }
  
  // Adjustments methods
  addAdjustment(adjustment: any) {
    const id = this.adjustments.length + 1;
    const newAdjustment = { ...adjustment, id, created_at_local: new Date().toISOString() };
    this.adjustments.push(newAdjustment);
    this.saveToLocalStorage();
    return id;
  }
  
  getAdjustments(filters?: any) {
    let filtered = this.adjustments;
    if (filters?.upc) {
      filtered = filtered.filter(a => a.upc === filters.upc);
    }
    if (filters?.type) {
      filtered = filtered.filter(a => a.adjustment_type === filters.type);
    }
    return filtered;
  }
  
  // Time clock methods
  addTimeClockEntry(entry: any) {
    const id = this.timeClockEntries.length + 1;
    const newEntry = { ...entry, id };
    this.timeClockEntries.push(newEntry);
    this.saveToLocalStorage();
    return id;
  }
  
  getTimeClockEntries(filters?: any) {
    let filtered = this.timeClockEntries;
    if (filters?.userId) {
      filtered = filtered.filter(e => e.user_id === filters.userId);
    }
    if (filters?.startDate) {
      filtered = filtered.filter(e => e.shift_date >= filters.startDate);
    }
    if (filters?.endDate) {
      filtered = filtered.filter(e => e.shift_date <= filters.endDate);
    }
    return filtered;
  }
  
  getCurrentShift(userId: number) {
    return this.timeClockEntries.find(e => 
      e.user_id === userId && e.punch_out === null
    );
  }
  
  // Clear all data
  clearAll() {
    this.inventory.clear();
    this.transactions = [];
    this.users.clear();
    this.storeInfo = null;
    this.tillSettings = null;
    this.currentTill = null;
    this.currentUser = null;
    this.adjustments = [];
    this.timeClockEntries = [];
    this.saveToLocalStorage();
  }
}

// Web fallback implementations
const webFallbacks: InventoryAPI = {
  // Product search
  searchByUpc: async (upc: string) => {
    const storage = WebStorage.getInstance();
    const item = storage.getInventoryItem(upc);
    
    if (item) {
      return {
        success: true,
        data: {
          upc: item.upc,
          category: item.category || null,
          description: item.description || null,
          volume: item.volume || null,
          pack: item.pack || null
        },
        inInventory: true
      };
    }
    
    return {
      success: false,
      error: 'Product not found in web storage'
    };
  },
  
  importCsv: async () => {
    return {
      success: false,
      error: 'CSV import not available in web mode'
    };
  },
  
  // Inventory management
  addToInventory: async (item) => {
    const storage = WebStorage.getInstance();
    const existing = storage.getInventoryItem(item.upc);
    
    if (existing) {
      existing.quantity += item.quantity;
      existing.cost = item.cost;
      existing.price = item.price;
      existing.updated_at = new Date().toISOString();
      storage.setInventoryItem(item.upc, existing);
      
      return {
        success: true,
        message: 'Inventory updated',
        updated: true
      };
    } else {
      const newItem = {
        ...item,
        id: Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      storage.setInventoryItem(item.upc, newItem);
      
      return {
        success: true,
        message: 'Item added to inventory'
      };
    }
  },
  
  getInventory: async () => {
    const storage = WebStorage.getInstance();
    const inventory = storage.getAllInventory();
    
    return {
      success: true,
      data: inventory
    };
  },
  
  checkInventory: async (upc: string) => {
    const storage = WebStorage.getInstance();
    const item = storage.getInventoryItem(upc);
    
    if (item) {
      return {
        success: true,
        data: {
          ...item,
          taxable: item.taxable !== undefined ? item.taxable : true // Default to taxable
        }
      };
    }
    
    return {
      success: false,
      error: 'Item not found in inventory'
    };
  },
  
  updateItemTaxable: async (upc: string, taxable: boolean) => {
    const storage = WebStorage.getInstance();
    const item = storage.getInventoryItem(upc);
    
    if (item) {
      item.taxable = taxable;
      storage.saveToLocalStorage();
      return {
        success: true,
        message: 'Taxable status updated'
      };
    }
    
    return {
      success: false,
      error: 'Item not found in inventory'
    };
  },
  
  searchInventoryByDescription: async (searchTerm: string) => {
    const storage = WebStorage.getInstance();
    const inventory = storage.getAllInventory();
    const filtered = inventory.filter(item => 
      item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return {
      success: true,
      data: filtered
    };
  },
  
  searchProductsByCategory: async (category: string) => {
    const storage = WebStorage.getInstance();
    const inventory = storage.getAllInventory();
    const filtered = inventory.filter(item => 
      item.category && item.category.toLowerCase() === category.toLowerCase()
    );
    
    return {
      success: true,
      data: filtered
    };
  },
  
  // Transactions
  saveTransaction: async (transaction) => {
    const storage = WebStorage.getInstance();
    const id = storage.addTransaction(transaction);
    
    // Update inventory quantities
    try {
      const items = JSON.parse(transaction.items);
      for (const item of items) {
        const inventoryItem = storage.getInventoryItem(item.upc);
        if (inventoryItem) {
          inventoryItem.quantity -= item.quantity;
          storage.setInventoryItem(item.upc, inventoryItem);
        }
      }
    } catch (error) {
      console.error('Failed to update inventory quantities:', error);
    }
    
    return {
      success: true,
      transactionId: id,
      message: 'Transaction saved'
    };
  },
  
  getTransactions: async () => {
    const storage = WebStorage.getInstance();
    const transactions = storage.getTransactions();
    
    return {
      success: true,
      data: transactions
    };
  },
  
  openTransactionDetails: async (transaction) => {
    console.log('Transaction details:', transaction);
    return Promise.resolve();
  },
  
  // Store info
  checkStoreInfo: async () => {
    const storage = WebStorage.getInstance();
    const storeInfo = storage.getStoreInfo();
    
    return {
      success: true,
      hasStoreInfo: storeInfo !== null,
      data: storeInfo
    };
  },
  
  saveStoreInfo: async (storeInfo) => {
    const storage = WebStorage.getInstance();
    storage.setStoreInfo(storeInfo);
    
    return {
      success: true,
      message: 'Store info saved'
    };
  },
  
  getStoreInfo: async () => {
    const storage = WebStorage.getInstance();
    const storeInfo = storage.getStoreInfo();
    
    return {
      success: true,
      data: storeInfo
    };
  },
  
  getInventoryTransactions: async () => {
    const storage = WebStorage.getInstance();
    const transactions = storage.getTransactions();
    const result: any[] = [];
    
    for (const transaction of transactions) {
      try {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          result.push({
            transaction_id: transaction.id,
            upc: item.upc,
            description: item.description,
            category: item.category || null,
            volume: item.volume || null,
            quantity: item.quantity,
            unit_price: item.price,
            total: item.price * item.quantity,
            payment_type: transaction.payment_type,
            transaction_total: transaction.total,
            created_at: transaction.created_at
          });
        }
      } catch (error) {
        console.error('Failed to parse transaction items:', error);
      }
    }
    
    return {
      success: true,
      data: result
    };
  },
  
  // Test data generation
  generateTestInventory: async (params) => {
    const storage = WebStorage.getInstance();
    const itemsToAdd = params.itemCount;
    
    for (let i = 0; i < itemsToAdd; i++) {
      const upc = `TEST${Date.now()}${i}`;
      const cost = Math.random() * (params.maxCost - params.minCost) + params.minCost;
      const price = cost * (1 + params.markupPercentage / 100);
      const quantity = Math.floor(Math.random() * (params.maxQuantity - params.minQuantity) + params.minQuantity);
      
      storage.setInventoryItem(upc, {
        id: Date.now() + i,
        upc,
        description: `Test Product ${i + 1}`,
        category: `Category ${Math.floor(i / 10) + 1}`,
        volume: '750ml',
        cost,
        price,
        quantity,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    return {
      success: true,
      itemsAdded: itemsToAdd
    };
  },
  
  clearInventory: async () => {
    const storage = WebStorage.getInstance();
    storage.clearInventory();
    
    return {
      success: true
    };
  },
  
  generateTestSales: async (params) => {
    const storage = WebStorage.getInstance();
    const inventory = storage.getAllInventory();
    
    if (inventory.length === 0) {
      return {
        success: false,
        error: 'No inventory available for test sales'
      };
    }
    
    let totalItems = 0;
    let totalValue = 0;
    
    for (let i = 0; i < params.numberOfSales; i++) {
      const itemCount = Math.floor(Math.random() * (params.maxItemsPerSale - params.minItemsPerSale + 1)) + params.minItemsPerSale;
      const items = [];
      let subtotal = 0;
      
      for (let j = 0; j < itemCount; j++) {
        const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        
        items.push({
          upc: randomItem.upc,
          description: randomItem.description,
          price: randomItem.price,
          quantity,
          category: randomItem.category,
          volume: randomItem.volume
        });
        
        subtotal += randomItem.price * quantity;
        totalItems += quantity;
      }
      
      const tax = subtotal * 0.06; // Default 6% tax
      const total = subtotal + tax;
      totalValue += total;
      
      const paymentType = params.paymentTypes[Math.floor(Math.random() * params.paymentTypes.length)];
      
      storage.addTransaction({
        items: JSON.stringify(items),
        subtotal,
        tax,
        total,
        payment_type: paymentType,
        cash_given: paymentType === 'cash' ? Math.ceil(total / 10) * 10 : undefined,
        change_given: paymentType === 'cash' ? Math.ceil(total / 10) * 10 - total : undefined
      });
    }
    
    return {
      success: true,
      salesCreated: params.numberOfSales,
      totalItems,
      totalValue
    };
  },
  
  clearTransactions: async () => {
    const storage = WebStorage.getInstance();
    storage.clearTransactions();
    
    return {
      success: true
    };
  },
  
  clearAllData: async () => {
    const storage = WebStorage.getInstance();
    const transactions = storage.getTransactions().length;
    const inventory = storage.getAllInventory().length;
    const adjustments = storage.getAdjustments().length;
    
    storage.clearAll();
    
    return {
      success: true,
      message: 'All data cleared',
      deleted: {
        transactions,
        inventory,
        adjustments
      }
    };
  },
  
  getDailySales: async (date: string) => {
    const storage = WebStorage.getInstance();
    const transactions = storage.getTransactions();
    const dayTransactions = transactions.filter(t => 
      t.created_at.startsWith(date)
    );
    
    const totalSales = dayTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalTax = dayTransactions.reduce((sum, t) => sum + t.tax, 0);
    
    const paymentBreakdown = {
      cash: dayTransactions.filter(t => t.payment_type === 'cash').reduce((sum, t) => sum + t.total, 0),
      debit: dayTransactions.filter(t => t.payment_type === 'debit').reduce((sum, t) => sum + t.total, 0),
      credit: dayTransactions.filter(t => t.payment_type === 'credit').reduce((sum, t) => sum + t.total, 0)
    };
    
    return {
      success: true,
      data: {
        date,
        totalSales,
        salesCount: dayTransactions.length,
        itemsSold: 0, // Would need to parse items
        avgSaleAmount: dayTransactions.length > 0 ? totalSales / dayTransactions.length : 0,
        totalTax,
        paymentBreakdown,
        hourlyBreakdown: [],
        topProducts: []
      }
    };
  },
  
  getInventoryAdjustments: async (filters) => {
    const storage = WebStorage.getInstance();
    const adjustments = storage.getAdjustments(filters);
    
    return {
      success: true,
      data: adjustments
    };
  },
  
  getWeeklySummary: async (date: string, periodType: 'week' | 'month') => {
    return {
      success: true,
      data: {
        period: `${periodType} of ${date}`,
        totalSales: 0,
        totalTransactions: 0,
        totalItems: 0,
        avgDailySales: 0,
        avgTransactionValue: 0,
        bestDay: { date: '', sales: 0 },
        worstDay: { date: '', sales: 0 },
        dailyData: [],
        topCategories: []
      }
    };
  },
  
  // User management
  checkUserType: async (username: string) => {
    const storage = WebStorage.getInstance();
    const users = storage.getAllUsers();
    const user = users.find(u => u.username === username);
    
    if (user) {
      return {
        success: true,
        role: user.role,
        requiresPin: user.role === 'cashier',
        requiresPassword: user.role !== 'cashier'
      };
    }
    
    return {
      success: false,
      error: 'User not found'
    };
  },
  
  userLogin: async (username: string, password: string) => {
    const storage = WebStorage.getInstance();
    const users = storage.getAllUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      storage.setCurrentUser(user);
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.full_name || user.fullName
        }
      };
    }
    
    return {
      success: false,
      error: 'Invalid credentials'
    };
  },
  
  userLoginPin: async (username: string, pin: string) => {
    const storage = WebStorage.getInstance();
    const users = storage.getAllUsers();
    const user = users.find(u => u.username === username && u.pin === pin);
    
    if (user) {
      storage.setCurrentUser(user);
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.full_name || user.fullName
        }
      };
    }
    
    return {
      success: false,
      error: 'Invalid PIN'
    };
  },
  
  userLogout: async () => {
    const storage = WebStorage.getInstance();
    storage.setCurrentUser(null);
    
    return {
      success: true
    };
  },
  
  getCurrentUser: async () => {
    const storage = WebStorage.getInstance();
    const user = storage.getCurrentUser();
    
    return {
      success: true,
      user: user || null
    };
  },
  
  getUsers: async () => {
    const storage = WebStorage.getInstance();
    const users = storage.getAllUsers();
    
    return {
      success: true,
      users
    };
  },
  
  addUserDuringSetup: async (userData) => {
    const storage = WebStorage.getInstance();
    const userId = storage.addUser({
      ...userData,
      full_name: userData.fullName,
      active: 1
    });
    
    return {
      success: true,
      userId
    };
  },
  
  addUser: async (userData) => {
    const storage = WebStorage.getInstance();
    const userId = storage.addUser({
      ...userData,
      full_name: userData.fullName,
      active: 1
    });
    
    return {
      success: true,
      userId
    };
  },
  
  removeUser: async (userId: number) => {
    const storage = WebStorage.getInstance();
    storage.removeUser(userId);
    
    return {
      success: true
    };
  },
  
  getUserActivity: async (_userId) => {
    return {
      success: true,
      activities: []
    };
  },
  
  // Time clock
  getCurrentShift: async (userId: number) => {
    const storage = WebStorage.getInstance();
    const shift = storage.getCurrentShift(userId);
    
    return {
      success: true,
      data: shift || null
    };
  },
  
  punchIn: async (userId: number) => {
    const storage = WebStorage.getInstance();
    const shiftId = storage.addTimeClockEntry({
      user_id: userId,
      punch_in: new Date().toISOString(),
      punch_out: null,
      shift_date: new Date().toISOString().split('T')[0]
    });
    
    return {
      success: true,
      shiftId
    };
  },
  
  punchOut: async (userId: number) => {
    const storage = WebStorage.getInstance();
    const shift = storage.getCurrentShift(userId);
    
    if (shift) {
      shift.punch_out = new Date().toISOString();
      const punchIn = new Date(shift.punch_in);
      const punchOut = new Date(shift.punch_out);
      const duration = Math.floor((punchOut.getTime() - punchIn.getTime()) / 60000);
      shift.duration_minutes = duration;
      
      return {
        success: true,
        duration
      };
    }
    
    return {
      success: false,
      error: 'No active shift found'
    };
  },
  
  getTimeClockEntries: async (filters) => {
    const storage = WebStorage.getInstance();
    const entries = storage.getTimeClockEntries(filters);
    
    return {
      success: true,
      data: entries
    };
  },
  
  focusWindow: async () => {
    window.focus();
    return Promise.resolve();
  },
  
  getInventoryAnalysis: async () => {
    const storage = WebStorage.getInstance();
    const inventory = storage.getAllInventory();
    
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCost = inventory.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    
    return {
      success: true,
      data: {
        metrics: {
          totalItems: inventory.length,
          totalQuantity,
          totalValue,
          totalCost,
          avgMargin: totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0,
          lowStockItems: inventory.filter(i => i.quantity < 10).length,
          overstockItems: inventory.filter(i => i.quantity > 100).length,
          deadStock: 0,
          fastMovers: 0,
          categoryBreakdown: [],
          stockLevels: {
            critical: inventory.filter(i => i.quantity === 0).length,
            low: inventory.filter(i => i.quantity > 0 && i.quantity < 10).length,
            normal: inventory.filter(i => i.quantity >= 10 && i.quantity <= 50).length,
            high: inventory.filter(i => i.quantity > 50 && i.quantity <= 100).length,
            excess: inventory.filter(i => i.quantity > 100).length
          }
        },
        items: inventory.map(item => ({
          upc: item.upc,
          description: item.description,
          category: item.category,
          cost: item.cost,
          price: item.price,
          quantity: item.quantity,
          value: item.price * item.quantity,
          margin: ((item.price - item.cost) / item.price) * 100,
          turnoverRate: 0,
          daysInStock: 0,
          lastSold: null
        }))
      }
    };
  },
  
  saveTransactionWithDate: async (transaction) => {
    const storage = WebStorage.getInstance();
    const id = storage.addTransaction({
      ...transaction,
      created_at: transaction.customDate
    });
    
    return {
      success: true,
      transactionId: id,
      message: 'Transaction saved with custom date'
    };
  },
  
  addToInventoryWithDate: async (item) => {
    const storage = WebStorage.getInstance();
    const existing = storage.getInventoryItem(item.upc);
    
    if (existing) {
      existing.quantity += item.quantity;
      existing.cost = item.cost;
      existing.price = item.price;
      existing.updated_at = item.customDate;
      storage.setInventoryItem(item.upc, existing);
      
      return {
        success: true,
        message: 'Inventory updated with custom date',
        updated: true
      };
    } else {
      const newItem = {
        ...item,
        id: Date.now(),
        created_at: item.customDate,
        updated_at: item.customDate
      };
      storage.setInventoryItem(item.upc, newItem);
      
      return {
        success: true,
        message: 'Item added to inventory with custom date'
      };
    }
  },
  
  getRandomProducts: async (count: number) => {
    const products = [];
    for (let i = 0; i < count; i++) {
      products.push({
        upc: `MOCK${Date.now()}${i}`,
        description: `Mock Product ${i + 1}`,
        volume: '750ml',
        wac: Math.random() * 50 + 10,
        retail: Math.random() * 80 + 20,
        category: `Category ${Math.floor(i / 5) + 1}`,
        subcategory: `Subcategory ${i % 3 + 1}`
      });
    }
    
    return {
      success: true,
      products
    };
  },
  
  clearMockData: async () => {
    return {
      success: true,
      message: 'Mock data cleared'
    };
  },
  
  saveMockTransaction: async (transaction) => {
    const storage = WebStorage.getInstance();
    const id = storage.addTransaction(transaction);
    
    return {
      success: true,
      transactionId: id
    };
  },
  
  // Till management
  getTillSettings: async () => {
    const storage = WebStorage.getInstance();
    const settings = storage.getTillSettings();
    
    return {
      success: true,
      data: settings
    };
  },
  
  saveTillSettings: async (settings) => {
    const storage = WebStorage.getInstance();
    storage.setTillSettings(settings);
    
    return {
      success: true
    };
  },
  
  getCurrentTill: async () => {
    const storage = WebStorage.getInstance();
    const till = storage.getCurrentTill();
    
    return {
      success: true,
      data: till
    };
  },
  
  initializeTill: async (denominations) => {
    const storage = WebStorage.getInstance();
    const startingCash = 
      denominations.ones * 1 +
      denominations.fives * 5 +
      denominations.tens * 10 +
      denominations.twenties * 20 +
      denominations.fifties * 50 +
      denominations.hundreds * 100;
    
    const till = {
      date: new Date().toISOString().split('T')[0],
      startingCash,
      currentCash: startingCash,
      transactions: 0,
      cashIn: 0,
      cashOut: 0,
      denominations
    };
    
    storage.setCurrentTill(till);
    
    return {
      success: true,
      data: till
    };
  },
  
  closeTill: async () => {
    const storage = WebStorage.getInstance();
    storage.setCurrentTill(null);
    
    return {
      success: true
    };
  },
  
  resetTill: async () => {
    const storage = WebStorage.getInstance();
    storage.setCurrentTill(null);
    
    return {
      success: true,
      data: null,
      message: 'Till reset'
    };
  },
  
  updateTillCash: async (amount: number, isReturn?: boolean) => {
    const storage = WebStorage.getInstance();
    const till = storage.getCurrentTill();
    
    if (till) {
      if (isReturn) {
        till.currentCash -= amount;
        till.cashOut += amount;
      } else {
        till.currentCash += amount;
        till.cashIn += amount;
      }
      till.transactions++;
      storage.setCurrentTill(till);
    }
    
    return {
      success: true
    };
  }
};

// Create the unified API layer
class APILayer {
  private api: InventoryAPI;
  
  constructor() {
    if (isElectron()) {
      // Use the real Electron API
      this.api = window.api;
    } else {
      // Use web fallbacks
      this.api = webFallbacks;
      console.log('Running in web mode - using local storage fallbacks');
    }
  }
  
  // Expose all API methods
  get searchByUpc() { return this.api.searchByUpc; }
  get importCsv() { return this.api.importCsv; }
  get addToInventory() { return this.api.addToInventory; }
  get getInventory() { return this.api.getInventory; }
  get checkInventory() { return this.api.checkInventory; }
  get updateItemTaxable() { return this.api.updateItemTaxable; }
  get searchInventoryByDescription() { return this.api.searchInventoryByDescription; }
  get searchProductsByCategory() { return this.api.searchProductsByCategory; }
  get saveTransaction() { return this.api.saveTransaction; }
  get getTransactions() { return this.api.getTransactions; }
  get openTransactionDetails() { return this.api.openTransactionDetails; }
  get checkStoreInfo() { return this.api.checkStoreInfo; }
  get saveStoreInfo() { return this.api.saveStoreInfo; }
  get getStoreInfo() { return this.api.getStoreInfo; }
  get getInventoryTransactions() { return this.api.getInventoryTransactions; }
  get generateTestInventory() { return this.api.generateTestInventory; }
  get clearInventory() { return this.api.clearInventory; }
  get generateTestSales() { return this.api.generateTestSales; }
  get clearTransactions() { return this.api.clearTransactions; }
  get clearAllData() { return this.api.clearAllData; }
  get getDailySales() { return this.api.getDailySales; }
  get getInventoryAdjustments() { return this.api.getInventoryAdjustments; }
  get getWeeklySummary() { return this.api.getWeeklySummary; }
  get checkUserType() { return this.api.checkUserType; }
  get userLogin() { return this.api.userLogin; }
  get userLoginPin() { return this.api.userLoginPin; }
  get userLogout() { return this.api.userLogout; }
  get getCurrentUser() { return this.api.getCurrentUser; }
  get getUsers() { return this.api.getUsers; }
  get addUserDuringSetup() { return this.api.addUserDuringSetup; }
  get addUser() { return this.api.addUser; }
  get removeUser() { return this.api.removeUser; }
  get getUserActivity() { return this.api.getUserActivity; }
  get getCurrentShift() { return this.api.getCurrentShift; }
  get punchIn() { return this.api.punchIn; }
  get punchOut() { return this.api.punchOut; }
  get getTimeClockEntries() { return this.api.getTimeClockEntries; }
  get focusWindow() { return this.api.focusWindow; }
  get getInventoryAnalysis() { return this.api.getInventoryAnalysis; }
  get saveTransactionWithDate() { return this.api.saveTransactionWithDate; }
  get addToInventoryWithDate() { return this.api.addToInventoryWithDate; }
  get getRandomProducts() { return this.api.getRandomProducts; }
  get clearMockData() { return this.api.clearMockData; }
  get saveMockTransaction() { return this.api.saveMockTransaction; }
  get getTillSettings() { return this.api.getTillSettings; }
  get saveTillSettings() { return this.api.saveTillSettings; }
  get getCurrentTill() { return this.api.getCurrentTill; }
  get initializeTill() { return this.api.initializeTill; }
  get closeTill() { return this.api.closeTill; }
  get resetTill() { return this.api.resetTill; }
  get updateTillCash() { return this.api.updateTillCash; }
}

// Export singleton instance
export const api = new APILayer();
export default api;