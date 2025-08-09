"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  addToInventory: (sku, name, qty) => electron.ipcRenderer.invoke("inventory:add", { sku, name, qty })
});
