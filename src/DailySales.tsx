import { useState, useEffect } from "react";
import DatePicker from "./components/DatePicker";
import DateRangePicker from "./components/DateRangePicker";
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
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<DailySalesData | null>(null);
  const [multiDaySalesData, setMultiDaySalesData] = useState<DailySalesData[]>([]);
  const [aggregatedData, setAggregatedData] = useState<DailySalesData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isRangeMode) {
      loadDateRangeSales();
    } else {
      loadDailySales();
    }
  }, [selectedDate, startDate, endDate, isRangeMode]);

  const loadDailySales = async () => {
    setLoading(true);
    setError("");
    
    try {
      const result = await window.api.getDailySales(selectedDate);
      
      if (result.success && result.data) {
        setSalesData(result.data);
        setMultiDaySalesData([]);
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

  const loadDateRangeSales = async () => {
    setLoading(true);
    setError("");
    setSalesData(null);
    setAggregatedData(null);
    
    try {
      const allData: DailySalesData[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Load data for each day in the range
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const result = await window.api.getDailySales(dateStr);
        
        if (result.success && result.data) {
          allData.push(result.data);
        }
      }
      
      setMultiDaySalesData(allData);
      
      // Aggregate the data for display
      if (allData.length > 0) {
        const aggregated = aggregateMultiDayData(allData);
        setAggregatedData(aggregated);
      } else {
        setError(`No sales data found for date range: ${startDate} to ${endDate}`);
      }
    } catch (err) {
      setError("Failed to load sales data for date range");
      console.error(err);
      setMultiDaySalesData([]);
      setAggregatedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
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

  const aggregateMultiDayData = (dataArray: DailySalesData[]): DailySalesData => {
    // Initialize aggregated data
    const aggregated: DailySalesData = {
      date: `${startDate} to ${endDate}`,
      totalSales: 0,
      salesCount: 0,
      itemsSold: 0,
      avgSaleAmount: 0,
      totalTax: 0,
      paymentBreakdown: {
        cash: 0,
        debit: 0,
        credit: 0
      },
      hourlyBreakdown: [],
      topProducts: []
    };

    // Aggregate basic metrics
    dataArray.forEach(day => {
      aggregated.totalSales += day.totalSales;
      aggregated.salesCount += day.salesCount;
      aggregated.itemsSold += day.itemsSold;
      aggregated.totalTax += day.totalTax;
      aggregated.paymentBreakdown.cash += day.paymentBreakdown.cash;
      aggregated.paymentBreakdown.debit += day.paymentBreakdown.debit;
      aggregated.paymentBreakdown.credit += day.paymentBreakdown.credit;
    });

    // Calculate average sale amount
    aggregated.avgSaleAmount = aggregated.salesCount > 0 
      ? aggregated.totalSales / aggregated.salesCount 
      : 0;

    // Aggregate hourly breakdown
    const hourlyMap = new Map<number, { sales: number; amount: number }>();
    dataArray.forEach(day => {
      day.hourlyBreakdown.forEach(hour => {
        const existing = hourlyMap.get(hour.hour) || { sales: 0, amount: 0 };
        hourlyMap.set(hour.hour, {
          sales: existing.sales + hour.sales,
          amount: existing.amount + hour.amount
        });
      });
    });
    
    aggregated.hourlyBreakdown = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour - b.hour);

    // Aggregate top products
    const productMap = new Map<string, { description: string; quantity: number; revenue: number }>();
    dataArray.forEach(day => {
      day.topProducts.forEach(product => {
        const existing = productMap.get(product.upc) || {
          description: product.description,
          quantity: 0,
          revenue: 0
        };
        productMap.set(product.upc, {
          description: product.description,
          quantity: existing.quantity + product.quantity,
          revenue: existing.revenue + product.revenue
        });
      });
    });

    aggregated.topProducts = Array.from(productMap.entries())
      .map(([upc, data]) => ({ upc, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 products

    return aggregated;
  };

  const getMaxHourlyAmount = () => {
    const data = isRangeMode ? aggregatedData : salesData;
    if (!data?.hourlyBreakdown.length) return 100;
    return Math.max(...data.hourlyBreakdown.map(h => h.amount));
  };

  // Determine which data to display
  const displayData = isRangeMode ? aggregatedData : salesData;

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
        <div className="date-controls">
          <div className="date-mode-toggle">
            <button 
              className={`mode-btn ${!isRangeMode ? 'active' : ''}`}
              onClick={() => setIsRangeMode(false)}
            >
              Single Day
            </button>
            <button 
              className={`mode-btn ${isRangeMode ? 'active' : ''}`}
              onClick={() => setIsRangeMode(true)}
            >
              Date Range
            </button>
          </div>
          <div className="date-selector">
            <label>{isRangeMode ? 'Select Date Range:' : 'Select Date:'}</label>
            {isRangeMode ? (
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateRangeChange}
                max={new Date().toISOString().split('T')[0]}
                className="date-picker"
                presetRanges={false}
              />
            ) : (
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                max={new Date().toISOString().split('T')[0]}
                className="date-picker"
              />
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="daily-sales-error">
          {error}
        </div>
      )}

      {!displayData || displayData.salesCount === 0 ? (
        <div className="no-sales">
          <p>
            {isRangeMode 
              ? `No sales recorded for date range: ${startDate} to ${endDate}`
              : `No sales recorded for ${new Date(selectedDate + 'T12:00:00').toLocaleDateString()}`
            }
          </p>
        </div>
      ) : (
        <>
          {/* Period indicator for date range */}
          {isRangeMode && (
            <div className="date-range-indicator">
              <strong>Date Range:</strong> {startDate} to {endDate}
            </div>
          )}
          
          {/* Key Metrics Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Total Revenue</div>
              <div className="metric-value">{formatCurrency(displayData.totalSales)}</div>
              <div className="metric-detail">Including tax</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Transactions</div>
              <div className="metric-value">{displayData.salesCount}</div>
              <div className="metric-detail">Avg: {formatCurrency(displayData.avgSaleAmount)}</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Items Sold</div>
              <div className="metric-value">{displayData.itemsSold}</div>
              <div className="metric-detail">{(displayData.itemsSold / displayData.salesCount).toFixed(1)} per sale</div>
            </div>
            
            <div className="metric-card">
              <div className="metric-label">Tax Collected</div>
              <div className="metric-value">{formatCurrency(displayData.totalTax)}</div>
              <div className="metric-detail"></div>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="payment-breakdown">
            <h4>Payment Methods</h4>
            <div className="payment-bars">
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Cash</span>
                  <span>{formatCurrency(displayData.paymentBreakdown.cash)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar cash-bar" 
                    style={{ width: `${(displayData.paymentBreakdown.cash / displayData.totalSales) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Debit</span>
                  <span>{formatCurrency(displayData.paymentBreakdown.debit)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar debit-bar" 
                    style={{ width: `${(displayData.paymentBreakdown.debit / displayData.totalSales) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="payment-bar">
                <div className="payment-label">
                  <span>Credit</span>
                  <span>{formatCurrency(displayData.paymentBreakdown.credit)}</span>
                </div>
                <div className="bar-container">
                  <div 
                    className="bar credit-bar" 
                    style={{ width: `${(displayData.paymentBreakdown.credit / displayData.totalSales) * 100}%` }}
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
                const hourData = displayData.hourlyBreakdown.find(h => h.hour === hour);
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
                  {displayData.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="no-data">No products sold</td>
                    </tr>
                  ) : (
                    displayData.topProducts.map((product, index) => (
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
              {' '}Processed {displayData.salesCount} transactions totaling {formatCurrency(displayData.totalSales)} 
              {' '}with {displayData.itemsSold} items sold.
            </div>
          </div>
        </>
      )}
    </div>
  );
}