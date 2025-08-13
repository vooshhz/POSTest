// REPLACE THE ENTIRE src/App.tsx file with this:

import CartScanner from "./CartScanner";
import InventoryList from "./InventoryList";
import { TransactionHistory } from "./TransactionHistory";
import { StoreSetup } from "./StoreSetup";
import Developer from "./Developer";
import Reports from "./Reports";
import "./App.css";
import { useState, useEffect } from "react";

interface CartItem {
  upc: string;
  description: string | null;
  volume: string | null;
  quantity: number;
  cost: number;
  price: number;
}


export default function App() {
  const [currentView, setCurrentView] = useState<"scanner" | "inventory" | "transactions" | "reports" | "developer">("scanner");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  
  // Cart Scanner state
  const [cartBarcode, setCartBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");
  
  // Inventory state
  const [inventoryBarcode, setInventoryBarcode] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Check for store info on component mount
  useEffect(() => {
    checkStoreInfo();
  }, []);

  const checkStoreInfo = async () => {
    try {
      const result = await window.api.checkStoreInfo();
      
      if (result.success) {
        if (result.hasStoreInfo && result.data) {
          setNeedsSetup(false);
          setStoreName(result.data.store_name);
          // Update window title with store name
          document.title = `${result.data.store_name} - POS System`;
        } else {
          setNeedsSetup(true);
        }
      } else {
        // If check fails, assume setup is needed
        setNeedsSetup(true);
      }
    } catch (error) {
      console.error('Failed to check store info:', error);
      setNeedsSetup(true);
    }
  };

  const handleSetupComplete = async () => {
    // Reload store info and continue to main app
    await checkStoreInfo();
  };

  const handleSetupCancel = () => {
    // Exit the application (in Electron, this would close the window)
    if (window.confirm('Are you sure you want to exit? The application cannot run without store information.')) {
      window.close();
    }
  };

  // Show loading while checking
  if (needsSetup === null) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show setup if needed
  if (needsSetup) {
    return <StoreSetup onComplete={handleSetupComplete} onCancel={handleSetupCancel} />;
  }

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
          className={`nav-tab developer-tab ${currentView === "developer" ? "active" : ""}`}
          onClick={() => setCurrentView("developer")}
        >
          Dev
        </button>
        <button 
          className={`nav-tab ${currentView === "scanner" ? "active" : ""}`}
          onClick={() => setCurrentView("scanner")}
        >
          Scanner
        </button>
        <button 
          className={`nav-tab ${currentView === "inventory" ? "active" : ""}`}
          onClick={() => {
            setCurrentView("inventory");
            // Trigger refresh when switching to inventory tab
            setInventoryRefreshKey(prev => prev + 1);
          }}
        >
          Inventory
        </button>
        <button 
          className={`nav-tab ${currentView === "transactions" ? "active" : ""}`}
          onClick={() => setCurrentView("transactions")}
        >
          Transactions
        </button>
        <button 
          className={`nav-tab ${currentView === "reports" ? "active" : ""}`}
          onClick={() => setCurrentView("reports")}
        >
          Reports
        </button>
      </div>
      
      <h1>{storeName || 'Liquor Inventory System'}</h1>
      
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
          key={inventoryRefreshKey}
          barcode={inventoryBarcode}
          setBarcode={setInventoryBarcode}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
        />
      ) : currentView === "transactions" ? (
        <TransactionHistory />
      ) : currentView === "reports" ? (
        <Reports />
      ) : (
        <Developer />
      )}
    </div>
  );
}