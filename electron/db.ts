import { app, IpcMain } from "electron";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Load native module in CJS context to avoid ESM __filename issues
const Database = require("better-sqlite3") as any;

let _db: any;

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
  return _db!;
}

export function addToInventory(sku: string, name: string, qty: number) {
  const d = db();
  const row = d.prepare("SELECT id FROM Product WHERE sku=?").get(sku) as { id: number } | undefined;
  const id =
    row?.id ?? Number(d.prepare("INSERT INTO Product (sku, name) VALUES (?, ?)").run(sku, name).lastInsertRowid);
  d.prepare("INSERT INTO StockLedger (product_id, qty_delta, reason) VALUES (?, ?, 'PURCHASE')").run(id, qty);
  const { on_hand } = d
    .prepare("SELECT COALESCE(SUM(qty_delta),0) AS on_hand FROM StockLedger WHERE product_id=?")
    .get(id) as { on_hand: number };
  return { productId: id, onHand: on_hand };
}

export function registerInventoryIpc(ipcMain: IpcMain) {
  ipcMain.handle("inventory:add", (_e, p: { sku: string; name: string; qty: number }) =>
    addToInventory(p.sku, p.name, Number(p.qty))
  );
}
