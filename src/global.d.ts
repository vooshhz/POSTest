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
    error?: string;
  }>;
  importCsv: () => Promise<{
    success: boolean;
    message?: string;
    count?: number;
    error?: string;
  }>;
}

declare global {
  interface Window {
    api: InventoryAPI;
  }
}