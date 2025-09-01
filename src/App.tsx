// REPLACE THE ENTIRE src/App.tsx file with this:

import CartScanner from "./CartScanner";
import InventoryList from "./InventoryList";
import { TransactionHistory } from "./TransactionHistory";
import { StoreSetup } from "./StoreSetup";
import Developer from "./Developer";
import Reports from "./Reports";
import Settings from "./Settings";
import Login from "./Login";
import Home from "./Home";
import TimeClock from "./TimeClock";
import TimeTracking from "./TimeTracking";
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

interface LogoutConfirmDialogProps {
  currentUser: any;
  onConfirm: (punchOut: boolean) => void;
  onCancel: () => void;
}

const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({ currentUser, onConfirm, onCancel }) => {
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [shiftInfo, setShiftInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkActiveShift();
  }, []);

  const checkActiveShift = async () => {
    if (currentUser?.role === 'cashier') {
      try {
        const result = await window.api.getCurrentShift(currentUser.id);
        if (result.success && result.data) {
          setHasActiveShift(true);
          setShiftInfo(result.data);
        }
      } catch (error) {
        console.error('Error checking shift:', error);
      }
    }
    setLoading(false);
  };

  const formatDuration = (punchIn: string) => {
    const start = new Date(punchIn);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        maxWidth: '450px',
        width: '90%'
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '20px' }}>Confirm Logout</h2>
        
        {hasActiveShift && shiftInfo && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#92400e' }}>
              ⚠️ Active Shift Detected
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: '#78350f' }}>
              You've been clocked in for {formatDuration(shiftInfo.punch_in)}
            </p>
          </div>
        )}
        
        <p style={{ margin: '0 0 24px', color: '#666' }}>
          {hasActiveShift 
            ? 'Would you like to punch out before logging out?'
            : 'Are you sure you want to log out?'}
        </p>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          
          {hasActiveShift && (
            <>
              <button
                onClick={() => onConfirm(false)}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#f59e0b',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Log Out Only
              </button>
              <button
                onClick={() => onConfirm(true)}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Punch Out & Log Out
              </button>
            </>
          )}
          
          {!hasActiveShift && (
            <button
              onClick={() => onConfirm(false)}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#dc3545',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Log Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export default function App() {
  const [currentView, setCurrentView] = useState<"home" | "scanner" | "inventory" | "transactions" | "reports" | "developer" | "settings" | "timetracking">("home");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTimeClock, setShowTimeClock] = useState(false);
  
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
      // Use the new checkInitialSetup API that doesn't require auth
      const setupResult = await window.api.checkInitialSetup();
      
      if (setupResult.success) {
        if (setupResult.needsSetup) {
          setNeedsSetup(true);
          console.log('Setup needed - Store info:', setupResult.hasStoreInfo, 
                      'Users:', setupResult.hasUsers, 
                      'User count:', setupResult.userCount);
        } else {
          setNeedsSetup(false);
          if (setupResult.storeData) {
            setStoreName(setupResult.storeData.store_name);
            // Update window title with store name
            document.title = `${setupResult.storeData.store_name} - POS System`;
          }
        }
      } else {
        // If the check failed, assume setup is needed
        console.error('Failed to check initial setup:', setupResult.error);
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
    
    // Show time clock for cashiers
    if (user.role === 'cashier') {
      setShowTimeClock(true);
    }
  };

  const handleDevAccess = () => {
    // Allow direct access to developer tools without login
    setCurrentUser({ username: 'dev', role: 'admin', fullName: 'Developer Mode' });
    setIsAuthenticated(true);
    setNeedsSetup(false); // Bypass setup screen
    setCurrentView('developer');
  };

  const handleLogout = async () => {
    // Check if cashier has active shift
    if (currentUser?.role === 'cashier') {
      try {
        const shiftResult = await window.api.getCurrentShift(currentUser.id);
        if (shiftResult.success && shiftResult.data) {
          // Cashier has active shift, show punch out option
          setShowLogoutConfirm(true);
          return;
        }
      } catch (error) {
        console.error('Error checking shift:', error);
      }
    }
    
    // No active shift or not a cashier, show regular logout confirm
    setShowLogoutConfirm(true);
  };
  
  const confirmLogout = async (punchOut: boolean = false) => {
    try {
      // Punch out if requested and user is cashier with active shift
      if (punchOut && currentUser?.role === 'cashier') {
        const punchOutResult = await window.api.punchOut(currentUser.id);
        if (!punchOutResult.success) {
          console.error('Failed to punch out:', punchOutResult.error);
        }
      }
      
      await window.api.userLogout();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentView("home");
      setShowLogoutConfirm(false);
      
      // Force a page reload to completely reset the app state
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Show loading while checking
  if (needsSetup === null || checkingAuth || isAuthenticated === null) {
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
    return <StoreSetup onComplete={handleSetupComplete} onCancel={handleSetupCancel} onDevAccess={handleDevAccess} />;
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} onDevAccess={handleDevAccess} storeName={storeName} />;
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
      {/* Time Clock Modal for Cashiers */}
      {showTimeClock && currentUser && (
        <TimeClock 
          user={currentUser}
          onClose={() => setShowTimeClock(false)}
          onLogout={async () => {
            setShowTimeClock(false);
            await window.api.userLogout();
            setCurrentUser(null);
            setIsAuthenticated(false);
            setCurrentView("home");
            window.location.reload();
          }}
        />
      )}

      {/* Custom Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <LogoutConfirmDialog
          currentUser={currentUser}
          onConfirm={confirmLogout}
          onCancel={cancelLogout}
        />
      )}
      
      <div className="nav-tabs-left">
        <button 
          className={`nav-tab dev-tab ${currentView === "developer" ? "active" : ""}`}
          onClick={() => setCurrentView("developer")}
          style={{
            backgroundColor: currentView === "developer" ? '#ff6b00' : '#ff8c00',
            color: 'white'
          }}
        >
          🔧 DEV
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
          className={`nav-tab home-tab-large ${currentView === "home" ? "active" : ""}`}
          onClick={() => setCurrentView("home")}
          title="Home"
        >
          <span className="home-icon">🏠</span>
          <span className="home-text">HOME</span>
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
        {currentView === "home" ? (
          <Home 
            onNavigate={(view) => {
              // Prevent cashiers from accessing reports
              if (view === 'reports' && currentUser?.role === 'cashier') {
                alert('Access denied. Reports are only available to managers and administrators.');
                return;
              }
              if (view === 'inventory') {
                setInventoryRefreshKey(prev => prev + 1);
              }
              setCurrentView(view as any);
            }}
            userRole={currentUser?.role}
          />
        ) : currentView === "scanner" ? (
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
          currentUser?.role !== 'cashier' ? (
            <Reports />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h2>Access Denied</h2>
              <p>Reports are only available to managers and administrators.</p>
            </div>
          )
        ) : currentView === "developer" ? (
          <Developer />
        ) : currentView === "timetracking" ? (
          currentUser?.role !== 'cashier' ? (
            <TimeTracking />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h2>Access Denied</h2>
              <p>Time tracking is only available to managers and administrators.</p>
            </div>
          )
        ) : (
          <Settings />
        )}
      </div>
    </div>
  );
}