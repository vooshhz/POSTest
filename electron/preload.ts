import { contextBridge, ipcRenderer } from "electron";

// Define the API interface
interface InventoryAPI {
  searchByUpc: (upc: string) => Promise<{
    success: boolean;
    data?: {
      upc: string;
      category: string | null;
      description: string | null;
      volume: string | null;
      pack: number | null;
    };
    inInventory?: boolean;
    error?: string;
  }>;
  importCsv: () => Promise<{
    success: boolean;
    message?: string;
    count?: number;
    error?: string;
  }>;
  addToInventory: (item: {
    upc: string;
    cost: number;
    price: number;
    quantity: number;
  }) => Promise<{
    success: boolean;
    message?: string;
    updated?: boolean;
    error?: string;
  }>;
  getInventory: () => Promise<{
    success: boolean;
    data?: Array<{
      id: number;
      upc: string;
      description: string | null;
      category: string | null;
      volume: string | null;
      cost: number;
      price: number;
      quantity: number;
      updated_at: string;
    }>;
    error?: string;
  }>;
  checkInventory: (upc: string) => Promise<{
    success: boolean;
    data?: {
      upc: string;
      description: string | null;
      category: string | null;
      volume: string | null;
      cost: number;
      price: number;
      quantity: number;
    };
    error?: string;
  }>;
  searchInventoryByDescription: (searchTerm: string) => Promise<{
    success: boolean;
    data?: Array<{
      upc: string;
      description: string | null;
      category: string | null;
      volume: string | null;
      cost: number;
      price: number;
      quantity: number;
    }>;
    error?: string;
  }>;
  saveTransaction: (transaction: {
    items: string;
    subtotal: number;
    tax: number;
    total: number;
    payment_type: 'cash' | 'debit' | 'credit';
    cash_given?: number;
    change_given?: number;
  }) => Promise<{
    success: boolean;
    transactionId?: number;
    message?: string;
    error?: string;
  }>;
  getTransactions: () => Promise<{
    success: boolean;
    data?: Array<{
      id: number;
      items: string;
      subtotal: number;
      tax: number;
      total: number;
      payment_type: string;
      cash_given: number | null;
      change_given: number | null;
      created_at: string;
    }>;
    error?: string;
  }>;
  openTransactionDetails: (transaction: {
    id: number;
    items: string;
    subtotal: number;
    tax: number;
    total: number;
    payment_type: string;
    cash_given: number | null;
    change_given: number | null;
    created_at: string;
  }) => Promise<void>;
  checkStoreInfo: () => Promise<{
    success: boolean;
    hasStoreInfo: boolean;
    data?: any;
    error?: string;
  }>;
  saveStoreInfo: (storeInfo: {
    store_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
    phone_number: string;
    tax_rate: number;
    receipt_header?: string;
    receipt_footer?: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  getStoreInfo: () => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  getInventoryTransactions: () => Promise<{
    success: boolean;
    data?: Array<{
      transaction_id: number;
      upc: string;
      description: string;
      category: string | null;
      volume: string | null;
      quantity: number;
      unit_price: number;
      total: number;
      payment_type: string;
      transaction_total: number;
      created_at: string;
    }>;
    error?: string;
  }>;
  generateTestInventory: (params: {
    itemCount: number;
    minCost: number;
    maxCost: number;
    markupPercentage: number;
    minQuantity: number;
    maxQuantity: number;
  }) => Promise<{
    success: boolean;
    itemsAdded?: number;
    error?: string;
  }>;
  clearInventory: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  generateTestSales: (params: {
    numberOfSales: number;
    minItemsPerSale: number;
    maxItemsPerSale: number;
    startDate: string;
    endDate: string;
    paymentTypes: string[];
  }) => Promise<{
    success: boolean;
    salesCreated?: number;
    totalItems?: number;
    totalValue?: number;
    error?: string;
  }>;
  clearTransactions: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  clearAllData: () => Promise<{
    success: boolean;
    message?: string;
    deleted?: {
      transactions: number;
      inventory: number;
      adjustments: number;
    };
    error?: string;
  }>;
  getDailySales: (date: string) => Promise<{
    success: boolean;
    data?: {
      date: string;
      totalSales: number;
      salesCount: number;
      itemsSold: number;
      avgSaleAmount: number;
      totalTax: number;
      paymentBreakdown: {
        cash: number;
        debit: number;
        credit: number;
      };
      hourlyBreakdown: Array<{
        hour: number;
        sales: number;
        amount: number;
      }>;
      topProducts: Array<{
        upc: string;
        description: string;
        quantity: number;
        revenue: number;
      }>;
    };
    error?: string;
  }>;
  getInventoryAdjustments: (filters?: { upc?: string; type?: string }) => Promise<{
    success: boolean;
    data?: Array<{
      id: number;
      upc: string;
      description: string;
      category: string | null;
      adjustment_type: string;
      quantity_change: number;
      quantity_before: number;
      quantity_after: number;
      cost: number | null;
      price: number | null;
      reference_id: number | null;
      reference_type: string | null;
      notes: string | null;
      created_by: string;
      created_at_local: string;
    }>;
    error?: string;
  }>;
  getWeeklySummary: (date: string, periodType: 'week' | 'month') => Promise<{
    success: boolean;
    data?: {
      period: string;
      totalSales: number;
      totalTransactions: number;
      totalItems: number;
      avgDailySales: number;
      avgTransactionValue: number;
      bestDay: {
        date: string;
        sales: number;
      };
      worstDay: {
        date: string;
        sales: number;
      };
      dailyData: Array<{
        date: string;
        sales: number;
        transactions: number;
        items: number;
      }>;
      weekOverWeek?: {
        sales: number;
        transactions: number;
      };
      topCategories: Array<{
        category: string;
        sales: number;
        items: number;
      }>;
    };
    error?: string;
  }>;
  // User Management
  userLogin: (username: string, password: string) => Promise<{
    success: boolean;
    user?: {
      id: number;
      username: string;
      role: string;
      fullName: string;
    };
    error?: string;
  }>;
  userLogout: () => Promise<{
    success: boolean;
    error?: string;
  }>;
  getCurrentUser: () => Promise<{
    success: boolean;
    user?: {
      id: number;
      username: string;
      role: string;
    } | null;
  }>;
  getUsers: () => Promise<{
    success: boolean;
    users?: Array<{
      id: number;
      username: string;
      role: string;
      full_name: string;
      active: number;
      created_at: string;
      last_login: string | null;
    }>;
    error?: string;
  }>;
  addUserDuringSetup: (userData: {
    username: string;
    password: string;
    role: string;
    fullName: string;
  }) => Promise<{
    success: boolean;
    userId?: number;
    error?: string;
  }>;
  addUser: (userData: {
    username: string;
    password: string;
    role: string;
    fullName: string;
  }) => Promise<{
    success: boolean;
    userId?: number;
    error?: string;
  }>;
  removeUser: (userId: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getUserActivity: (userId?: number) => Promise<{
    success: boolean;
    activities?: Array<{
      id: number;
      user_id: number;
      username: string;
      full_name: string;
      action: string;
      details: string | null;
      timestamp: string;
    }>;
    error?: string;
  }>;
  getInventoryAnalysis: () => Promise<{
    success: boolean;
    data?: {
      metrics: {
        totalItems: number;
        totalQuantity: number;
        totalValue: number;
        totalCost: number;
        avgMargin: number;
        lowStockItems: number;
        overstockItems: number;
        deadStock: number;
        fastMovers: number;
        categoryBreakdown: Array<{
          category: string;
          items: number;
          quantity: number;
          value: number;
        }>;
        stockLevels: {
          critical: number;
          low: number;
          normal: number;
          high: number;
          excess: number;
        };
      };
      items: Array<{
        upc: string;
        description: string;
        category: string | null;
        cost: number;
        price: number;
        quantity: number;
        value: number;
        margin: number;
        turnoverRate: number;
        daysInStock: number;
        lastSold: string | null;
      }>;
    };
    error?: string;
  }>;
}

// Expose protected methods to the renderer
const api: InventoryAPI = {
  searchByUpc: (upc: string) => ipcRenderer.invoke("search-by-upc", upc),
  importCsv: () => ipcRenderer.invoke("import-csv"),
  addToInventory: (item) => ipcRenderer.invoke("add-to-inventory", item),
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  checkInventory: (upc: string) => ipcRenderer.invoke("check-inventory", upc),
  searchInventoryByDescription: (searchTerm: string) => ipcRenderer.invoke("search-inventory-by-description", searchTerm),
  saveTransaction: (transaction) => ipcRenderer.invoke("save-transaction", transaction),
  getTransactions: () => ipcRenderer.invoke("get-transactions"),
  openTransactionDetails: (transaction) => ipcRenderer.invoke("open-transaction-details", transaction),
  checkStoreInfo: () => ipcRenderer.invoke("check-store-info"),
  saveStoreInfo: (storeInfo) => ipcRenderer.invoke("save-store-info", storeInfo),
  getStoreInfo: () => ipcRenderer.invoke("get-store-info"),
  getInventoryTransactions: () => ipcRenderer.invoke("get-inventory-transactions"),
  generateTestInventory: (params) => ipcRenderer.invoke("generate-test-inventory", params),
  clearInventory: () => ipcRenderer.invoke("clear-inventory"),
  getInventoryAdjustments: (filters) => ipcRenderer.invoke("get-inventory-adjustments", filters),
  generateTestSales: (params) => ipcRenderer.invoke("generate-test-sales", params),
  clearTransactions: () => ipcRenderer.invoke("clear-transactions"),
  clearAllData: () => ipcRenderer.invoke("clear-all-data"),
  getDailySales: (date) => ipcRenderer.invoke("get-daily-sales", date),
  getWeeklySummary: (date, periodType) => ipcRenderer.invoke("get-weekly-summary", date, periodType),
  getInventoryAnalysis: () => ipcRenderer.invoke("get-inventory-analysis"),
  // User Management
  userLogin: (username, password) => ipcRenderer.invoke("user-login", username, password),
  userLogout: () => ipcRenderer.invoke("user-logout"),
  getCurrentUser: () => ipcRenderer.invoke("get-current-user"),
  getUsers: () => ipcRenderer.invoke("get-users"),
  addUserDuringSetup: (userData) => ipcRenderer.invoke("add-user-during-setup", userData),
  addUser: (userData) => ipcRenderer.invoke("add-user", userData),
  removeUser: (userId) => ipcRenderer.invoke("remove-user", userId),
  getUserActivity: (userId) => ipcRenderer.invoke("get-user-activity", userId)
};

contextBridge.exposeInMainWorld("api", api);

// Type declaration for TypeScript
export type { InventoryAPI };