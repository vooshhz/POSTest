// REPLACE THE ENTIRE src/global.d.ts file with this:

export interface InventoryAPI {
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

declare global {
  interface Window {
    api: InventoryAPI;
  }
}