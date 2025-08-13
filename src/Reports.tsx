import { useState } from "react";
import DailySales from "./DailySales";
import WeeklySummary from "./reports/WeeklySummary";
import InventoryAnalysis from "./reports/InventoryAnalysis";
import ProductPerformance from "./reports/ProductPerformance";
import FinancialReports from "./reports/FinancialReports";
import HourlyAnalysis from "./reports/HourlyAnalysis";
import VendorAnalysis from "./reports/VendorAnalysis";
import ComplianceAudit from "./reports/ComplianceAudit";
import "./Reports.css";

type ReportTab = 'daily-sales' | 'weekly-summary' | 'inventory-analysis' | 
                 'product-performance' | 'financial' | 'hourly-analysis' | 
                 'vendor-analysis' | 'compliance';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('daily-sales');

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'daily-sales', label: 'Daily Sales' },
    { id: 'weekly-summary', label: 'Weekly/Monthly' },
    { id: 'inventory-analysis', label: 'Inventory' },
    { id: 'product-performance', label: 'Products' },
    { id: 'financial', label: 'Financial' },
    { id: 'hourly-analysis', label: 'Hourly/Shift' },
    { id: 'vendor-analysis', label: 'Vendors' },
    { id: 'compliance', label: 'Compliance' }
  ];

  return (
    <div className="reports-container">
      <h2>Reports & Analytics</h2>
      
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
        {activeTab === 'daily-sales' && <DailySales />}
        {activeTab === 'weekly-summary' && <WeeklySummary />}
        {activeTab === 'inventory-analysis' && <InventoryAnalysis />}
        {activeTab === 'product-performance' && <ProductPerformance />}
        {activeTab === 'financial' && <FinancialReports />}
        {activeTab === 'hourly-analysis' && <HourlyAnalysis />}
        {activeTab === 'vendor-analysis' && <VendorAnalysis />}
        {activeTab === 'compliance' && <ComplianceAudit />}
      </div>
    </div>
  );
}