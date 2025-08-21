/**
 * Web API layer that makes HTTP requests to the server
 * Used when running as a web app instead of Electron
 */

// Get the base URL for API calls
const getApiUrl = () => {
  // In production on Fly.io, use relative URLs
  // In development, you might want to use a different URL
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

export const webApi = {
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
      return {
        success: true,
        data: result || []
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.message || 'Failed to load inventory'
      };
    }
  },

  addToInventory: async (item: any) => {
    try {
      const result = await makeApiCall('/add-to-inventory', 'POST', item);
      return result;
    } catch (error: any) {
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
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Transaction management
  saveTransaction: async (transaction: any) => {
    try {
      const result = await makeApiCall('/create-transaction', 'POST', {
        items: transaction.items,
        subtotal: transaction.subtotal,
        tax: transaction.tax,
        total: transaction.total,
        paymentType: transaction.payment_type,
        cashGiven: transaction.cash_given,
        changeGiven: transaction.change_given,
        userId: transaction.created_by_user_id,
        username: transaction.created_by_username
      });
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: (error as any).message || 'Failed to save transaction' 
      };
    }
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
      return {
        success: true,
        data: result || []
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: (error as any).message || 'Failed to load transactions'
      };
    }
  },

  // User management
  checkUserType: async (username: string) => {
    // For web version, we'll check if user exists first
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
    // For PIN login, we'll use password field since our server doesn't have separate PIN auth
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

  getUsers: async () => {
    try {
      const result = await makeApiCall('/users');
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
    } catch (error: any) {
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

  updateStoreInfo: async (info: any) => {
    try {
      const result = await makeApiCall('/store-info', 'POST', info);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // User management during setup
  addUserDuringSetup: async (userData: any) => {
    try {
      const result = await makeApiCall('/add-user', 'POST', userData);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  addUser: async (userData: any) => {
    try {
      const result = await makeApiCall('/add-user', 'POST', userData);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // Reports
  getDailySales: async (date: string) => {
    try {
      const result = await makeApiCall(`/daily-sales/${date}`);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: (error as any).message || 'Failed to load sales data'
      };
    }
  },

  getWeeklySummary: async (date: string, periodType: 'week' | 'month') => {
    try {
      const result = await makeApiCall(`/weekly-summary?date=${date}&period=${periodType}`);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  getInventoryAdjustments: async (filters?: any) => {
    try {
      let url = '/inventory-adjustments';
      if (filters) {
        const params = new URLSearchParams(filters);
        url += `?${params}`;
      }
      const result = await makeApiCall(url);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  },

  getInventoryAnalysis: async () => {
    try {
      const result = await makeApiCall('/inventory-analysis');
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  getInventoryTransactions: async () => {
    try {
      const result = await makeApiCall('/inventory-transactions');
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  },

  // P&L and Financial Reports
  getPnL: async (startDate: string, endDate: string) => {
    try {
      const result = await makeApiCall(`/pnl?startDate=${startDate}&endDate=${endDate}`);
      return {
        success: true,
        data: result || {
          revenue: 0,
          costOfGoodsSold: 0,
          grossProfit: 0,
          grossMargin: 0,
          operatingExpenses: 0,
          netProfit: 0,
          netMargin: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        data: {
          revenue: 0,
          costOfGoodsSold: 0,
          grossProfit: 0,
          grossMargin: 0,
          operatingExpenses: 0,
          netProfit: 0,
          netMargin: 0
        }
      };
    }
  },

  getCategoryPerformance: async (_startDate: string, _endDate: string) => {
    return {
      success: true,
      data: []
    };
  },

  getProductPerformance: async (_startDate: string, _endDate: string, _limit: number) => {
    return {
      success: true,
      data: []
    };
  },

  getOperatingExpenses: async (_startDate: string, _endDate: string) => {
    return {
      success: true,
      data: []
    };
  },

  comparePnLPeriods: async (_start1: string, _end1: string, _start2: string, _end2: string) => {
    return {
      success: true,
      data: {
        current: {},
        previous: {},
        changes: {}
      }
    };
  },

  addOperatingExpense: async (_expense: any) => {
    return {
      success: true
    };
  },

  // Health check
  healthCheck: async () => {
    try {
      const result = await makeApiCall('/health');
      return result;
    } catch (error) {
      return { status: 'error', error: (error as any).message };
    }
  }
};