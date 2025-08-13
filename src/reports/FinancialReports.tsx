import { useState, useEffect } from "react";
import "./FinancialReports.css";

export default function FinancialReports() {
  const [period, setPeriod] = useState('today');
  const [financialData, setFinancialData] = useState<any>(null);

  useEffect(() => {
    fetchFinancialData();
  }, [period]);

  const fetchFinancialData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await window.api.getDailySales(today);
      if (result.success && result.data) {
        setFinancialData(result.data);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="financial-reports-container">
      <div className="financial-header">
        <h3>Financial Reports</h3>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="period-select">
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      <div className="financial-metrics">
        <div className="metric-card revenue">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">{formatCurrency(financialData?.totalSales || 0)}</div>
        </div>
        
        <div className="metric-card tax">
          <div className="metric-label">Tax Collected</div>
          <div className="metric-value">{formatCurrency(financialData?.totalTax || 0)}</div>
        </div>
        
        <div className="metric-card transactions">
          <div className="metric-label">Transactions</div>
          <div className="metric-value">{financialData?.salesCount || 0}</div>
        </div>
      </div>

      <div className="payment-methods">
        <h4>Payment Methods</h4>
        <div className="payment-grid">
          <div className="payment-card">
            <span className="payment-type">Cash</span>
            <span className="payment-amount">{formatCurrency(financialData?.paymentBreakdown?.cash || 0)}</span>
          </div>
          <div className="payment-card">
            <span className="payment-type">Debit</span>
            <span className="payment-amount">{formatCurrency(financialData?.paymentBreakdown?.debit || 0)}</span>
          </div>
          <div className="payment-card">
            <span className="payment-type">Credit</span>
            <span className="payment-amount">{formatCurrency(financialData?.paymentBreakdown?.credit || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}