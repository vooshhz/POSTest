import { useState, useEffect } from "react";
import "./DailySales.css";

interface DailySalesData {
  date: string;
  totalSales: number;
  salesCount: number;
  itemsSold: number;
  avgSaleAmount: number;
  totalTax: number;
  paymentBreakdown: {
    cash: number;
    debit: number;
    credit: number;
  };
  hourlyBreakdown: Array<{
    hour: number;
    sales: number;
    amount: number;
  }>;
  topProducts: Array<{
    upc: string;
    description: string;
    quantity: number;
    revenue: number;
  }>;
}

export default function DailySales() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<DailySalesData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDailySales();
  }, [selectedDate]);

  const loadDailySales = async () => {
    setLoading(true);
    setError("");
    
    try {
      const result = await window.api.getDailySales(selectedDate);
      
      if (result.success && result.data) {
        setSalesData(result.data);
      } else {
        setError(result.error || "Failed to load sales data");
        setSalesData(null);
      }
    } catch (err) {
      setError("Failed to load sales data");
      console.error(err);
      setSalesData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  const getMaxHourlyAmount = () => {
    if (!salesData?.hourlyBreakdown.length) return 100;
    return Math.max(...salesData.hourlyBreakdown.map(h => h.amount));
  };

  if (loading) {
    return (
      <div className="daily-sales-loading">
        <div className="loading-spinner"></div>
        <p>Loading sales data...</p>
      </div>
    );
  }

  return (
    <div className="daily-sales-container">
      <div className="daily-sales-header">
        <h3>Daily Sales Report</h3>
        <div className="date-selector">
          <label>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="date-picker"
          />
        </div>
      </div>

      {error && (
        <div className="daily-sales-error">
          {error}
        </div>
      )}

      {!salesData || salesData.salesCount === 0 ? (
        <div className="no-sales">
          <p>No sales recorded for {new Date(selectedDate + 'T12:00:00').toLocaleDateString()}</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="metrics-grid">
            <div className="metric-card primary">
              <div className="metric-label">Total Revenue</div>
              <div className="metric-value">{formatCurrency(salesData.totalSales)}</div>
              <div className="metric-detail">Including tax</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Transactions</div>
              <div className="metric-value">{salesData.salesCount}</div>
              <div className="metric-detail">Avg: {formatCurrency(salesData.avgSaleAmount)}</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Items Sold</div>
              <div className="metric-value">{salesData.itemsSold}</div>
              <div className="metric-detail">{(salesData.itemsSold / salesData.salesCount).toFixed(1)} per sale</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Tax Collected</div>
              <div className="metric-value">{formatCurrency(salesData.totalTax)}</div>
              <div className="metric-detail">{((salesData.totalTax / salesData.totalSales) * 100).toFixed(1)}% of total</div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="payment-breakdown">
            <h4>Payment Methods</h4>
            <div className="payment-bars">
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Cash</span>
                  <span>{formatCurrency(salesData.paymentBreakdown.cash)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar cash-bar" 
                    style={{ width: `${(salesData.paymentBreakdown.cash / salesData.totalSales) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Debit</span>
                  <span>{formatCurrency(salesData.paymentBreakdown.debit)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar debit-bar" 
                    style={{ width: `${(salesData.paymentBreakdown.debit / salesData.totalSales) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Credit</span>
                  <span>{formatCurrency(salesData.paymentBreakdown.credit)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar credit-bar" 
                    style={{ width: `${(salesData.paymentBreakdown.credit / salesData.totalSales) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Sales Chart */}
          <div className="hourly-sales">
            <h4>Sales by Hour</h4>
            <div className="hourly-chart">
              {Array.from({ length: 24 }, (_, hour) => {
                const hourData = salesData.hourlyBreakdown.find(h => h.hour === hour);
                const amount = hourData?.amount || 0;
                const maxAmount = getMaxHourlyAmount();
                const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                
                return (
                  <div key={hour} className="hour-bar-container">
                    <div className="hour-bar-wrapper">
                      <div 
                        className="hour-bar" 
                        style={{ height: `${height}%` }}
                        title={`${formatTime(hour)}: ${formatCurrency(amount)}`}
                      >
                        {amount > 0 && (
                          <span className="bar-value">{hourData?.sales}</span>
                        )}
                      </div>
                    </div>
                    <div className="hour-label">{formatTime(hour)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="top-products">
            <h4>Top Selling Products</h4>
            <div className="products-table">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>UPC</th>
                    <th>Quantity</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="no-data">No products sold</td>
                    </tr>
                  ) : (
                    salesData.topProducts.map((product, index) => (
                      <tr key={product.upc}>
                        <td>
                          <div className="product-rank">
                            <span className="rank">#{index + 1}</span>
                            {product.description}
                          </div>
                        </td>
                        <td className="upc-cell">{product.upc}</td>
                        <td className="quantity-cell">{product.quantity}</td>
                        <td className="revenue-cell">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="daily-summary">
            <div className="summary-text">
              <strong>Daily Summary:</strong> 
              {' '}Processed {salesData.salesCount} transactions totaling {formatCurrency(salesData.totalSales)} 
              {' '}with {salesData.itemsSold} items sold.
            </div>
          </div>
        </>
      )}
    </div>
  );
}