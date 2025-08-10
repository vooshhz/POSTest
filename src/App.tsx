// REPLACE THE ENTIRE src/App.tsx file with this:

import CartScanner from "./CartScanner";
import InventoryList from "./InventoryList";
import "./App.css";
import { useState } from "react";

export default function App() {
  const [currentView, setCurrentView] = useState<"scanner" | "inventory">("scanner");

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
      <h1>Liquor Inventory System</h1>
      
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
      </div>
      
      {currentView === "scanner" ? <CartScanner /> : <InventoryList />}
    </div>
  );
}