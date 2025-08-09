export {};
declare global {
  interface Window {
    api: {
      addToInventory(
        sku: string,
        name: string,
        qty: number
      ): Promise<{ productId: number; onHand: number }>;
    };
  }
}