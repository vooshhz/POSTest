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
      "• All adjustments and history\n\n" +
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
      const inventoryResult = await window.api.clearInventory();
      const salesResult = await window.api.clearTransactions();
      
      if (inventoryResult.success && salesResult.success) {
        setMessage("✅ All data cleared successfully");
      } else {
        const errors = [];
        if (!inventoryResult.success) errors.push(`Inventory: ${inventoryResult.error}`);
        if (!salesResult.success) errors.push(`Sales: ${salesResult.error}`);
        setMessage(`❌ Errors occurred:\n${errors.join('\n')}`);
      }
    } catch (error) {
      setMessage(`❌ Failed to clear data: ${error}`);
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
          <p>Removes ALL data - inventory, sales, and transactions. Complete reset!</p>
          <button 
            className="clear-btn clear-all"
            onClick={handleClearAll}
            disabled={clearing}
          >
            Clear Everything
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