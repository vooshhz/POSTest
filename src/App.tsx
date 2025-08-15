// REPLACE THE ENTIRE src/App.tsx file with this:

import CartScanner from "./CartScanner";
import InventoryList from "./InventoryList";
import { TransactionHistory } from "./TransactionHistory";
import { StoreSetup } from "./StoreSetup";
import Developer from "./Developer";
import Reports from "./Reports";
import Settings from "./Settings";
import Login from "./Login";
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
  const [currentView, setCurrentView] = useState<"scanner" | "inventory" | "transactions" | "reports" | "developer" | "settings">("scanner");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Cart Scanner state
  const [cartBarcode, setCartBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState("");
  
  // Inventory state
  const [inventoryBarcode, setInventoryBarcode] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Check for store info and authentication on component mount
  useEffect(() => {
    checkAuthentication();
    checkStoreInfo();
  }, []);

  // Update date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
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

  const checkAuthentication = async () => {
    try {
      console.log('Checking authentication...');
      const result = await window.api.getCurrentUser();
      console.log('Auth check result:', result);
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (!confirmed) return;

    try {
      await window.api.userLogout();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentView("scanner");
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading while checking
  if (needsSetup === null || checkingAuth) {
    console.log('Loading state - needsSetup:', needsSetup, 'checkingAuth:', checkingAuth);
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

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} storeName={storeName} />;
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
      <div className="nav-tabs-left">
        <button 
          className={`nav-tab developer-tab ${currentView === "developer" ? "active" : ""}`}
          onClick={() => setCurrentView("developer")}
        >
          Dev
        </button>
        <button 
          className={`nav-tab settings-tab ${currentView === "settings" ? "active" : ""}`}
          onClick={() => setCurrentView("settings")}
        >
          Settings
        </button>
        <div className="user-info">
          <span className="username">{currentUser?.username} ({currentUser?.role})</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
      
      <div className="nav-tabs-right">
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
      
      <div className="header-info">
        <h1 className="store-title">{storeName || 'Liquor Inventory System'}</h1>
        <div className="date-time">
          <span className="date">{currentDateTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span className="time">{currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
      
      <div className="content-container">
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
      ) : currentView === "developer" ? (
        <Developer />
      ) : (
        <Settings />
      )}
      </div>
    </div>
  );
}