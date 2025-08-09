export {};

export interface ProductData {
  itemNumber: string;
  categoryName: string;
  itemDescription: string;
  vendor: string;
  vendorName: string;
  bottleVolumeML: string;
  pack: string;
  upc: string;
  stateBottleCost: string;
  stateBottleRetail: string;
}

declare global {
  interface Window {
    api: {
      addToInventory(
        sku: string,
        name: string,
        qty: number
      ): Promise<{ productId: number; onHand: number }>;
      searchProductByUPC(upc: string): Promise<ProductData | null>;
    };
  }
}