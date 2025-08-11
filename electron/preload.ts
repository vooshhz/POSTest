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
  getInventoryTransactions: () => ipcRenderer.invoke("get-inventory-transactions")
};

contextBridge.exposeInMainWorld("api", api);

// Type declaration for TypeScript
export type { InventoryAPI };