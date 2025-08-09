import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  addToInventory: (sku: string, name: string, qty: number) =>
    ipcRenderer.invoke("inventory:add", { sku, name, qty }),
});
