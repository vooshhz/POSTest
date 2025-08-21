import { useState, Component, ReactNode } from "react";
import Sales from "./reports/Sales";
import InventoryAnalysis from "./reports/InventoryAnalysis";
import ProductPerformance from "./reports/ProductPerformance";
import FinancialReports from "./reports/FinancialReports";
import VendorAnalysis from "./reports/VendorAnalysis";
import ComplianceAudit from "./reports/ComplianceAudit";
import Replenishment from "./reports/Replenishment";
import ProfitAndLoss from "./reports/ProfitAndLoss";
import "./Reports.css";

// Error boundary to catch component errors
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Report component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h3>Error loading report</h3>
          <p>{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
        <ErrorBoundary>
          {activeTab === 'sales' && <Sales />}
          {activeTab === 'pnl' && <ProfitAndLoss />}
          {activeTab === 'inventory-analysis' && <InventoryAnalysis />}
          {activeTab === 'product-performance' && <ProductPerformance />}
          {activeTab === 'replenishment' && <Replenishment />}
          {activeTab === 'financial' && <FinancialReports />}
          {activeTab === 'vendor-analysis' && <VendorAnalysis />}
          {activeTab === 'compliance' && <ComplianceAudit />}
        </ErrorBoundary>
      </div>
    </div>
  );
}