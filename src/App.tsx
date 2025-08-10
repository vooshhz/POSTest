import BarcodeScanner from "./BarcodeScanner";
import "./App.css";
import { useState } from "react";

export default function App() {
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

  return (
    <div className="app">
      <h1>Liquor Inventory System</h1>
      
      <div style={{ marginBottom: "2rem" }}>
        <button 
          onClick={handleImport}
          disabled={importing}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: importing ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: importing ? "not-allowed" : "pointer"
          }}
        >
          {importing ? "Importing..." : "Import CSV Data"}
        </button>
        {importStatus && (
          <p style={{ marginTop: "10px" }}>{importStatus}</p>
        )}
      </div>
      
      <BarcodeScanner />
    </div>
  );
}