import { useState } from "react";
import Sales from "./reports/Sales";
import InventoryAnalysis from "./reports/InventoryAnalysis";
import ProductPerformance from "./reports/ProductPerformance";
import FinancialReports from "./reports/FinancialReports";
import VendorAnalysis from "./reports/VendorAnalysis";
import ComplianceAudit from "./reports/ComplianceAudit";
import Replenishment from "./reports/Replenishment";
import ProfitAndLoss from "./reports/ProfitAndLoss";
import "./Reports.css";

type ReportTab = 'sales' | 'inventory-analysis' | 
                 'product-performance' | 'financial' | 
                 'vendor-analysis' | 'compliance' | 'replenishment' | 'pnl';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'sales', label: 'Sales' },
    { id: 'pnl', label: 'P&L' },
    { id: 'inventory-analysis', label: 'Inventory' },
    { id: 'product-performance', label: 'Products' },
    { id: 'replenishment', label: 'Replenishment' },
    { id: 'financial', label: 'Financial' },
    { id: 'vendor-analysis', label: 'Vendors' },
    { id: 'compliance', label: 'Compliance' }
  ];

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Reports & Analytics</h2>
      </div>
      
      <div className="reports-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`report-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="reports-content">
        {activeTab === 'sales' && <Sales />}
        {activeTab === 'pnl' && <ProfitAndLoss />}
        {activeTab === 'inventory-analysis' && <InventoryAnalysis />}
        {activeTab === 'product-performance' && <ProductPerformance />}
        {activeTab === 'replenishment' && <Replenishment />}
        {activeTab === 'financial' && <FinancialReports />}
        {activeTab === 'vendor-analysis' && <VendorAnalysis />}
        {activeTab === 'compliance' && <ComplianceAudit />}
      </div>
    </div>
  );
}