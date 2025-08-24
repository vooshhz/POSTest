/**
 * Web API layer that makes HTTP requests to the server
 * Used when running as a web app instead of Electron
 */

// Get the base URL for API calls
const getApiUrl = () => {
  // Use environment variable if available, otherwise use relative URLs
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, use relative URLs (same origin)
  return '';
};

const makeApiCall = async (endpoint: string, method: string = 'GET', body?: any) => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if available in localStorage
        ...(localStorage.getItem('authToken') && {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        })
      },
      // Include credentials for CORS
      credentials: 'include',
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
    // Use the dedicated endpoint to check user type
    try {
      const result = await makeApiCall('/check-user-type', 'POST', { username });
      return result;
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
      // Store user in localStorage after successful login
      if (result.success && result.user) {
        localStorage.setItem('currentUser', JSON.stringify(result.user));
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }
  },

  userLoginPin: async (username: string, pin: string) => {
    // Use the dedicated PIN login endpoint
    try {
      const result = await makeApiCall('/login-pin', 'POST', { username, pin });
      // Store user in localStorage after successful login
      if (result.success && result.user) {
        localStorage.setItem('currentUser', JSON.stringify(result.user));
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: 'Invalid PIN'
      };
    }
  },

  userLogout: async () => {
    // Clear user from localStorage
    localStorage.removeItem('currentUser');
    return { success: true };
  },

  getCurrentUser: async () => {
    // Get user from localStorage
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          success: true,
          user: user
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return {
      success: false,
      user: null
    };
  },

  getUsers: async () => {
    try {
      const users = await makeApiCall('/users');
      return {
        success: true,
        users: users || []
      };
    } catch (error) {
      return {
        success: false,
        users: [],
        error: 'Failed to load users'
      };
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

  removeUser: async (userId: number) => {
    try {
      const result = await makeApiCall(`/remove-user/${userId}`, 'DELETE');
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
  },

  // Test data generation endpoints
  generateTestInventory: async (params: any) => {
    try {
      const result = await makeApiCall('/generate-test-inventory', 'POST', params);
      return result;
    } catch (error) {
      return { success: false, error: (error as any).message };
    }
  },

  clearInventory: async () => {
    try {
      const result = await makeApiCall('/clear-inventory', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: (error as any).message };
    }
  },

  clearAllData: async () => {
    try {
      const result = await makeApiCall('/clear-all-data', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: (error as any).message };
    }
  },

  generateTestSales: async (params: any) => {
    try {
      const result = await makeApiCall('/generate-test-sales', 'POST', params);
      return result;
    } catch (error) {
      return { success: false, error: (error as any).message };
    }
  },

  clearTransactions: async () => {
    try {
      const result = await makeApiCall('/clear-transactions', 'POST', {});
      return result;
    } catch (error) {
      return { success: false, error: (error as any).message };
    }
  }
};