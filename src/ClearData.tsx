import { useState } from "react";
import "./ClearData.css";

export default function ClearData() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");

  const handleClearInventory = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL inventory data!\n\n" +
      "This action cannot be undone. Are you absolutely sure?"
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      "Please confirm again: Delete ALL inventory data?"
    );

    if (!doubleConfirmed) return;

    setClearing(true);
    setMessage("Clearing inventory data...");

    try {
      const result = await window.api.clearInventory();
      if (result.success) {
        setMessage("✅ Inventory data cleared successfully");
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to clear inventory: ${error}`);
    } finally {
      setClearing(false);
    }
  };

  const handleClearSales = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL sales and transaction data!\n\n" +
      "This action cannot be undone. Are you absolutely sure?"
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      "Please confirm again: Delete ALL sales and transaction data?"
    );

    if (!doubleConfirmed) return;

    setClearing(true);
    setMessage("Clearing sales data...");

    try {
      const result = await window.api.clearTransactions();
      if (result.success) {
        setMessage("✅ Sales data cleared successfully");
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to clear sales: ${error}`);
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "⚠️ CRITICAL WARNING: This will permanently delete ALL data!\n\n" +
      "• All inventory data\n" +
      "• All sales and transactions\n" +
      "• All adjustments and history\n" +
      "• All time clock data\n\n" +
      "This action cannot be undone. Are you absolutely sure?"
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      "FINAL WARNING: Delete ALL store data?\n\nType 'DELETE ALL' to confirm."
    );

    if (!doubleConfirmed) return;

    setClearing(true);
    setMessage("Clearing all data...");

    try {
      // Use the clearAllData API which properly clears everything including adjustments
      const result = await window.api.clearAllData();
      
      if (result.success) {
        setMessage(`✅ ${result.message}\n\nRestarting application...`);
        // Give time to show the message before reloading
        setTimeout(() => {
          // Force a complete reload to reinitialize everything
          window.location.href = window.location.href;
        }, 2000);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to clear data: ${error}`);
    } finally {
      setClearing(false);
    }
  };

  const handleFactoryReset = async () => {
    const confirmed = window.confirm(
      "⚠️ FACTORY RESET WARNING!\n\n" +
      "This will COMPLETELY RESET the system to factory defaults:\n\n" +
      "• Delete ALL inventory, sales, and transactions\n" +
      "• Delete ALL store information\n" +
      "• Delete ALL user accounts (except default admin)\n" +
      "• Reset admin password to 'admin'\n" +
      "• Clear ALL time clock data\n\n" +
      "This action CANNOT be undone! Are you absolutely sure?"
    );

    if (!confirmed) return;

    // Triple confirmation for factory reset
    const prompt = window.prompt(
      "Type 'FACTORY RESET' to confirm this irreversible action:"
    );

    if (prompt !== "FACTORY RESET") {
      setMessage("Factory reset cancelled");
      return;
    }

    setClearing(true);
    setMessage("Performing factory reset...");

    try {
      const result = await window.api.factoryReset();
      
      if (result.success) {
        setMessage(`✅ ${result.message}\n\nRestarting application...`);
        // Give time to show the message before reloading
        setTimeout(() => {
          // Force a complete reload to reinitialize everything
          window.location.href = window.location.href;
        }, 2000);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to perform factory reset: ${error}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="clear-data-container">
      <div className="clear-data-warning">
        <h3>⚠️ Data Management - Danger Zone</h3>
        <p>These actions are permanent and cannot be undone. Use with extreme caution!</p>
      </div>

      <div className="clear-data-actions">
        <div className="clear-action-card">
          <h4>Clear Inventory Data</h4>
          <p>Removes all inventory items, stock levels, and adjustments</p>
          <button 
            className="clear-btn clear-inventory"
            onClick={handleClearInventory}
            disabled={clearing}
          >
            Clear All Inventory
          </button>
        </div>

        <div className="clear-action-card">
          <h4>Clear Sales Data</h4>
          <p>Removes all sales transactions, receipts, and transaction history</p>
          <button 
            className="clear-btn clear-sales"
            onClick={handleClearSales}
            disabled={clearing}
          >
            Clear All Sales
          </button>
        </div>

        <div className="clear-action-card danger">
          <h4>Clear All Data</h4>
          <p>Removes ALL data - inventory, sales, and transactions. Keeps users and store info.</p>
          <button 
            className="clear-btn clear-all"
            onClick={handleClearAll}
            disabled={clearing}
          >
            Clear All Data
          </button>
        </div>

        <div className="clear-action-card danger">
          <h4>🔴 FACTORY RESET</h4>
          <p>COMPLETE SYSTEM RESET - Deletes EVERYTHING including store info and users!</p>
          <button 
            className="clear-btn factory-reset"
            onClick={handleFactoryReset}
            disabled={clearing}
            style={{ backgroundColor: '#8B0000', color: 'white' }}
          >
            FACTORY RESET
          </button>
        </div>
      </div>

      {message && (
        <div className={`clear-message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}