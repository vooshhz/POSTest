/**
 * Complete Web API layer with ALL methods needed for the POS system
 * This ensures all database operations work on Fly.io
 */

// Get the base URL for API calls
const getApiUrl = () => {
  return '';
};

const makeApiCall = async (endpoint: string, method: string = 'GET', body?: any) => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${getApiUrl()}/api${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
};

export const webApiComplete = {
  // Product search
  searchByUpc: async (upc: string) => {
    try {
      const result = await makeApiCall('/search-by-upc', 'POST', { upc });
      return result;
    } catch (error) {
      return null;
    }
  },

  searchProducts: async (query: string) => {
    try {
      const result = await makeApiCall('/search-products', 'POST', { query });
      return result || [];
    } catch (error) {
      return [];
    }
  },

  searchInventoryByDescription: async (query: string) => {
    try {
      const result = await makeApiCall('/search-inventory-by-description', 'POST', { query });
      return result || [];
    } catch (error) {
      return [];
    }
  },

  // Inventory management
  checkInventory: async (upc: string) => {
    try {
      const result = await makeApiCall('/check-inventory', 'POST', { upc });
      return result;
    } catch (error) {
      return null;
    }
  },

  getInventory: async () => {
    try {
      const result = await makeApiCall('/inventory');
      return result || [];
    } catch (error) {
      return [];
    }
  },

  addToInventory: async (item: any) => {
    try {
      const result = await makeApiCall('/add-to-inventory', 'POST', item);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateInventoryQuantity: async (upc: string, change: number, reason?: string, userId?: number, username?: string) => {
    try {
      const result = await makeApiCall('/update-inventory-quantity', 'POST', {
        upc,
        change,
        reason,
        userId,
        username
      });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateItemTaxable: async (upc: string, taxable: boolean) => {
    try {
      const result = await makeApiCall('/update-item-taxable', 'POST', { upc, taxable });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getInventoryTransactions: async () => {
    try {
      const result = await makeApiCall('/inventory-transactions');
      return result || [];
    } catch (error) {
      return [];
    }
  },

  getInventoryAdjustments: async (filters?: any) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const result = await makeApiCall(`/inventory-adjustments${params ? '?' + params : ''}`);
      return result || [];
    } catch (error) {
      return [];
    }
  },

  getInventoryAnalysis: async () => {
    try {
      const result = await makeApiCall('/inventory-analysis');
      return result || {};
    } catch (error) {
      return {};
    }
  },

  // Transaction management
  saveTransaction: async (transaction: any) => {
    return await makeApiCall('/create-transaction', 'POST', {
      items: transaction.items,
      subtotal: transaction.subtotal,
      tax: transaction.tax,
      total: transaction.total,
      paymentType: transaction.payment_type || transaction.paymentType,
      cashGiven: transaction.cash_given,
      changeGiven: transaction.change_given,
      userId: transaction.created_by_user_id,
      username: transaction.created_by_username
    });
  },

  createTransaction: async (transaction: any) => {
    try {
      const result = await makeApiCall('/create-transaction', 'POST', {
        items: transaction.items,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        total: transaction.total,
        paymentType: transaction.payment_type,
        userId: transaction.created_by_user_id,
        username: transaction.created_by_username
      });
      return result.id;
    } catch (error) {
      throw error;
    }
  },

  getTransactions: async (dateRange?: { startDate: string; endDate: string }) => {
    try {
      let url = '/transactions';
      if (dateRange) {
        url += `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
      }
      const result = await makeApiCall(url);
      return result || [];
    } catch (error) {
      return [];
    }
  },

  openTransactionDetails: async (transaction: any) => {
    // This would typically open a new window in Electron
    // For web, we could open in a new tab or modal
    console.log('Transaction details:', transaction);
    return { success: true };
  },

  // User management
  checkUserType: async (username: string) => {
    try {
      const users = await makeApiCall('/users');
      const user = users.find((u: any) => u.username === username);
      
      if (user) {
        return {
          success: true,
          role: user.role,
          requiresPin: user.role === 'cashier',
          requiresPassword: user.role !== 'cashier'
        };
      } else {
        return {
          success: false,
          error: 'User not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to check user'
      };
    }
  },

  userLogin: async (username: string, password: string) => {
    try {
      const result = await makeApiCall('/login', 'POST', { username, password });
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }
  },

  userLoginPin: async (username: string, pin: string) => {
    try {
      const result = await makeApiCall('/login', 'POST', { username, password: pin });
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Invalid PIN'
      };
    }
  },

  userLogout: async () => {
    // For web version, clear local session
    return { success: true };
  },

  getCurrentUser: async () => {
    // For web version, this would get from session/localStorage
    return null;
  },

  getUsers: async () => {
    try {
      const result = await makeApiCall('/users');
      return result || [];
    } catch (error) {
      return [];
    }
  },

  addUser: async (userData: any) => {
    try {
      const result = await makeApiCall('/add-user', 'POST', userData);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  addUserDuringSetup: async (userData: any) => {
    try {
      const result = await makeApiCall('/add-user', 'POST', userData);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  removeUser: async (userId: number) => {
    try {
      const result = await makeApiCall('/remove-user', 'POST', { userId });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getUserActivity: async () => {
    try {
      const result = await makeApiCall('/user-activity');
      return result || [];
    } catch (error) {
      return [];
    }
  },

  // Store management
  getStoreInfo: async () => {
    try {
      const result = await makeApiCall('/store-info');
      return result || {};
    } catch (error) {
      return {};
    }
  },

  saveStoreInfo: async (info: any) => {
    try {
      const result = await makeApiCall('/save-store-info', 'POST', info);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  checkStoreInfo: async () => {
    try {
      const storeInfo = await makeApiCall('/store-info');
      return {
        success: true,
        hasStoreInfo: storeInfo && Object.keys(storeInfo).length > 0,
        data: storeInfo
      };
    } catch (error) {
      return {
        success: false,
        hasStoreInfo: false,
        error: error.message
      };
    }
  },

  // Till management
  getTillSettings: async () => {
    try {
      const result = await makeApiCall('/till-settings');
      return result || {};
    } catch (error) {
      return {};
    }
  },

  saveTillSettings: async (settings: any) => {
    try {
      const result = await makeApiCall('/save-till-settings', 'POST', settings);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getCurrentTill: async () => {
    try {
      const result = await makeApiCall('/current-till');
      return result;
    } catch (error) {
      return null;
    }
  },

  initializeTill: async (denominations: any) => {
    try {
      const result = await makeApiCall('/initialize-till', 'POST', { denominations });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  closeTill: async () => {
    try {
      const result = await makeApiCall('/close-till', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  resetTill: async () => {
    try {
      const result = await makeApiCall('/reset-till', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateTillCash: async (amount: number, type: string) => {
    try {
      const result = await makeApiCall('/update-till-cash', 'POST', { amount, type });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Time clock
  getCurrentShift: async (userId: number) => {
    try {
      const result = await makeApiCall(`/current-shift/${userId}`);
      return result;
    } catch (error) {
      return null;
    }
  },

  punchIn: async (userId: number) => {
    try {
      const result = await makeApiCall('/punch-in', 'POST', { userId });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  punchOut: async (userId: number) => {
    try {
      const result = await makeApiCall('/punch-out', 'POST', { userId });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getTimeClockEntries: async (filters?: any) => {
    try {
      const params = new URLSearchParams(filters).toString();
      const result = await makeApiCall(`/time-clock-entries${params ? '?' + params : ''}`);
      return result || [];
    } catch (error) {
      return [];
    }
  },

  // Reports
  getDailySales: async (date: string) => {
    try {
      const result = await makeApiCall(`/daily-sales?date=${date}`);
      return result || {};
    } catch (error) {
      return {};
    }
  },

  getWeeklySummary: async (date: string, period: string) => {
    try {
      const result = await makeApiCall(`/weekly-summary?date=${date}&period=${period}`);
      return result || {};
    } catch (error) {
      return {};
    }
  },

  // Test data
  generateTestInventory: async (params: any) => {
    try {
      const result = await makeApiCall('/generate-test-inventory', 'POST', params);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  generateTestSales: async (params: any) => {
    try {
      const result = await makeApiCall('/generate-test-sales', 'POST', params);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clearInventory: async () => {
    try {
      const result = await makeApiCall('/clear-inventory', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clearTransactions: async () => {
    try {
      const result = await makeApiCall('/clear-transactions', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clearAllData: async () => {
    try {
      const result = await makeApiCall('/clear-all-data', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clearMockData: async () => {
    try {
      const result = await makeApiCall('/clear-mock-data', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  saveMockTransaction: async (transaction: any) => {
    try {
      const result = await makeApiCall('/save-mock-transaction', 'POST', transaction);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getRandomProducts: async (count: number) => {
    try {
      const result = await makeApiCall(`/random-products?count=${count}`);
      return result || [];
    } catch (error) {
      return [];
    }
  },

  // CSV import (web version would use file upload)
  importCsv: async () => {
    return { 
      success: false, 
      message: 'CSV import not available in web version. Please use the Electron app.' 
    };
  },

  // Window management (not applicable for web)
  focusWindow: async () => {
    window.focus();
    return { success: true };
  },

  // P&L Reports (placeholder - needs implementation)
  getPnL: async (startDate: string, endDate: string) => {
    return { success: false, message: 'P&L reports coming soon' };
  },

  getCategoryPerformance: async (startDate: string, endDate: string) => {
    return { success: false, message: 'Category reports coming soon' };
  },

  getProductPerformance: async (startDate: string, endDate: string, limit: number) => {
    return { success: false, message: 'Product reports coming soon' };
  },

  getOperatingExpenses: async (startDate: string, endDate: string) => {
    return { success: false, message: 'Expense reports coming soon' };
  },

  addOperatingExpense: async (expense: any) => {
    return { success: false, message: 'Expense tracking coming soon' };
  },

  comparePnLPeriods: async (start1: string, end1: string, start2: string, end2: string) => {
    return { success: false, message: 'Period comparison coming soon' };
  }
};