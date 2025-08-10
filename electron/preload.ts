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
}

// Expose protected methods to the renderer
const api: InventoryAPI = {
  searchByUpc: (upc: string) => ipcRenderer.invoke("search-by-upc", upc),
  importCsv: () => ipcRenderer.invoke("import-csv"),
  addToInventory: (item) => ipcRenderer.invoke("add-to-inventory", item),
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  checkInventory: (upc: string) => ipcRenderer.invoke("check-inventory", upc)
};

contextBridge.exposeInMainWorld("api", api);

// Type declaration for TypeScript
export type { InventoryAPI };