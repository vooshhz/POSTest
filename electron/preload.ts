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
    error?: string;
  }>;
  importCsv: () => Promise<{
    success: boolean;
    message?: string;
    count?: number;
    error?: string;
  }>;
}

// Expose protected methods to the renderer
const api: InventoryAPI = {
  searchByUpc: (upc: string) => ipcRenderer.invoke("search-by-upc", upc),
  importCsv: () => ipcRenderer.invoke("import-csv")
};

contextBridge.exposeInMainWorld("api", api);

// Type declaration for TypeScript
export type { InventoryAPI };