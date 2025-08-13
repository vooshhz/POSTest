import { useState } from "react";
import TestInventory from "./TestInventory";
import TestSales from "./TestSales";
import "./Developer.css";

export default function Developer() {
  const [activeTab, setActiveTab] = useState<'test-inventory' | 'test-sales'>('test-inventory');

  return (
    <div className="developer-container">
      <div className="dev-header">
        <h2>Developer Tools</h2>
        <p className="dev-warning">⚠️ Development tools - Use with caution</p>
      </div>
      
      <div className="dev-tabs">
        <button 
          className={`dev-tab ${activeTab === 'test-inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('test-inventory')}
        >
          Test Inventory
        </button>
        <button 
          className={`dev-tab ${activeTab === 'test-sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('test-sales')}
        >
          Test Sales
        </button>
      </div>
      
      <div className="dev-content">
        {activeTab === 'test-inventory' && <TestInventory />}
        {activeTab === 'test-sales' && <TestSales />}
      </div>
    </div>
  );
}