// REPLACE THE ENTIRE src/App.tsx file with this:

import CartScanner from "./CartScanner";
import InventoryList from "./InventoryList";
import { TransactionHistory } from "./TransactionHistory";
import "./App.css";
import { useState } from "react";

interface CartItem {
  upc: string;
  description: string | null;
  volume: string | null;
  quantity: number;
  cost: number;
  price: number;
}


export default function App() {
  const [currentView, setCurrentView] = useState<"scanner" | "inventory" | "transactions">("scanner");
  
  // Cart Scanner state
  const [cartBarcode, setCartBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");
  
  // Inventory state
  const [inventoryBarcode, setInventoryBarcode] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  /* Commented out CSV import functionality - preserved for future use
  const [importStatus, setImportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  
  const handleImport = async () => {
    setImporting(true);
    setImportStatus("Importing CSV data...");
    
    try {
      const result = await window.api.importCsv();
      if (result.success) {
        setImportStatus(`✅ ${result.message}`);
      } else {
        setImportStatus(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setImportStatus(`❌ Import failed: ${error}`);
    } finally {
      setImporting(false);
    }
  };
  */

  return (
    <div className="app">
      <div className="nav-tabs">
        <button 
          className={`nav-tab ${currentView === "scanner" ? "active" : ""}`}
          onClick={() => setCurrentView("scanner")}
        >
          Scanner
        </button>
        <button 
          className={`nav-tab ${currentView === "inventory" ? "active" : ""}`}
          onClick={() => setCurrentView("inventory")}
        >
          Inventory
        </button>
        <button 
          className={`nav-tab ${currentView === "transactions" ? "active" : ""}`}
          onClick={() => setCurrentView("transactions")}
        >
          Transactions
        </button>
      </div>
      
      <h1>Liquor Inventory System</h1>
      
      {currentView === "scanner" ? (
        <CartScanner 
          barcode={cartBarcode}
          setBarcode={setCartBarcode}
          cart={cart}
          setCart={setCart}
          error={cartError}
          setError={setCartError}
        />
      ) : currentView === "inventory" ? (
        <InventoryList 
          barcode={inventoryBarcode}
          setBarcode={setInventoryBarcode}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
        />
      ) : (
        <TransactionHistory />
      )}
    </div>
  );
}