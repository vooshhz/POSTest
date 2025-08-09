import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require2 = createRequire(import.meta.url);
const Database = require2("better-sqlite3");
let _db;
function db() {
  if (!_db) {
    const file = path.join(app.getPath("userData"), "pos.sqlite");
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS Product(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        barcode TEXT,
        price_cents INTEGER DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS StockLedger(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        qty_delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES Product(id)
      );
    `);
  }
  return _db;
}
function addToInventory(sku, name, qty) {
  const d = db();
  const row = d.prepare("SELECT id FROM Product WHERE sku=?").get(sku);
  const id = (row == null ? void 0 : row.id) ?? Number(d.prepare("INSERT INTO Product (sku, name) VALUES (?, ?)").run(sku, name).lastInsertRowid);
  d.prepare("INSERT INTO StockLedger (product_id, qty_delta, reason) VALUES (?, ?, 'PURCHASE')").run(id, qty);
  const { on_hand } = d.prepare("SELECT COALESCE(SUM(qty_delta),0) AS on_hand FROM StockLedger WHERE product_id=?").get(id);
  return { productId: id, onHand: on_hand };
}
function registerInventoryIpc(ipcMain2) {
  ipcMain2.handle(
    "inventory:add",
    (_e, p) => addToInventory(p.sku, p.name, Number(p.qty))
  );
}
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  registerInventoryIpc(ipcMain);
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
