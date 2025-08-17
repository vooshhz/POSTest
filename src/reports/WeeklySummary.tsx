import { useState, useEffect } from "react";
import DatePicker from "../components/DatePicker";
import "./WeeklySummary.css";

type PeriodType = 'week' | 'month' | 'ytd';

interface SalesData {
  date: string;
  sales: number;
  transactions: number;
  items: number;
}

interface WeeklySummaryData {
  period: string;
  totalSales: number;
  totalTransactions: number;
  totalItems: number;
  avgDailySales: number;
  avgTransactionValue: number;
  bestDay: {
    date: string;
    sales: number;
  };
  worstDay: {
    date: string;
    sales: number;
  };
  dailyData: SalesData[];
  weekOverWeek?: {
    sales: number;
    transactions: number;
  };
  topCategories: Array<{
    category: string;
    sales: number;
    items: number;
  }>;
}

interface WeeklySummaryProps {
  periodType?: PeriodType;
  customDate?: string;
}

export default function WeeklySummary({ periodType: propPeriodType, customDate }: WeeklySummaryProps) {
  const [periodType, setPeriodType] = useState<PeriodType>(propPeriodType || 'week');
  const [selectedDate, setSelectedDate] = useState(() => {
    if (customDate) return customDate;
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeeklySummaryData | null>(null);

  useEffect(() => {
    if (propPeriodType) {
      setPeriodType(propPeriodType);
    }
  }, [propPeriodType]);

  useEffect(() => {
    if (customDate) {
      setSelectedDate(customDate);
    }
  }, [customDate]);

  useEffect(() => {
    fetchSummaryData();
  }, [selectedDate, periodType]);

  const fetchSummaryData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For YTD, we'll use month type and handle the display differently
      const apiPeriodType = periodType === 'ytd' ? 'month' : periodType;
      const result = await window.api.getWeeklySummary(selectedDate, apiPeriodType);
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load summary data');
      }
    } catch (err) {
      setError('Error fetching summary data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeLabel = () => {
    if (!data) return '';
    
    const date = new Date(selectedDate);
    if (periodType === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    } else if (periodType === 'month') {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (periodType === 'ytd') {
      const year = date.getFullYear();
      return `Year to Date - ${year}`;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="weekly-summary-loading">
        <div className="loading-spinner"></div>
        <p>Loading summary data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weekly-summary-container">
        <div className="weekly-summary-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="weekly-summary-container">
        <div className="no-data">No data available for selected period</div>
      </div>
    );
  }

  const maxSales = Math.max(...data.dailyData.map(d => d.sales));

  return (
    <div className="weekly-summary-container">
      <div className="weekly-summary-header">
        <h3>{periodType === 'week' ? 'Weekly' : periodType === 'month' ? 'Monthly' : 'Year to Date'} Summary</h3>
        
        {!propPeriodType && (
          <div className="period-controls">
            <div className="period-type-selector">
              <button
                className={`period-btn ${periodType === 'week' ? 'active' : ''}`}
                onClick={() => setPeriodType('week')}
            >
              Weekly
            </button>
            <button
              className={`period-btn ${periodType === 'month' ? 'active' : ''}`}
              onClick={() => setPeriodType('month')}
            >
              Monthly
            </button>
          </div>
          
          <div className="date-selector">
            <label>Select Date:</label>
            <DatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              className="date-picker"
            />
          </div>
        </div>
        )}
      </div>

      <div className="period-label">{getDateRangeLabel()}</div>

      {/* Key Metrics */}
      <div className="summary-metrics">
        <div className="metric-card highlight">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">{formatCurrency(data.totalSales)}</div>
          {data.weekOverWeek && (
            <div className={`metric-change ${data.weekOverWeek.sales >= 0 ? 'positive' : 'negative'}`}>
              {formatPercent(data.weekOverWeek.sales)} vs previous {periodType}
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Transactions</div>
          <div className="metric-value">{data.totalTransactions.toLocaleString()}</div>
          {data.weekOverWeek && (
            <div className={`metric-change ${data.weekOverWeek.transactions >= 0 ? 'positive' : 'negative'}`}>
              {formatPercent(data.weekOverWeek.transactions)} vs previous
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="metric-label">Items Sold</div>
          <div className="metric-value">{data.totalItems.toLocaleString()}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Avg Daily Sales</div>
          <div className="metric-value">{formatCurrency(data.avgDailySales)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Avg Transaction</div>
          <div className="metric-value">{formatCurrency(data.avgTransactionValue)}</div>
        </div>
      </div>

      {/* Best/Worst Days */}
      <div className="performance-cards">
        <div className="performance-card best">
          <h4>Best Day</h4>
          <div className="performance-date">
            {new Date(data.bestDay.date).toLocaleDateString()}
          </div>
          <div className="performance-value">
            {formatCurrency(data.bestDay.sales)}
          </div>
        </div>

        <div className="performance-card worst">
          <h4>Worst Day</h4>
          <div className="performance-date">
            {new Date(data.worstDay.date).toLocaleDateString()}
          </div>
          <div className="performance-value">
            {formatCurrency(data.worstDay.sales)}
          </div>
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className="daily-sales-chart">
        <h4>Daily Sales Trend</h4>
        <div className="chart-container">
          {data.dailyData.map((day, index) => (
            <div key={index} className="day-column">
              <div className="day-bar-wrapper">
                <div 
                  className="day-bar"
                  style={{ height: `${(day.sales / maxSales) * 100}%` }}
                  title={`${formatCurrency(day.sales)} - ${day.transactions} transactions`}
                >
                  <span className="bar-amount">{formatCurrency(day.sales)}</span>
                </div>
              </div>
              <div className="day-label">
                {new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Categories */}
      <div className="top-categories">
        <h4>Top Categories</h4>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Revenue</th>
              <th>Items Sold</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {data.topCategories.map((category, index) => (
              <tr key={index}>
                <td>
                  <div className="category-rank">
                    <span className="rank">#{index + 1}</span>
                    {category.category || 'Uncategorized'}
                  </div>
                </td>
                <td className="revenue-cell">{formatCurrency(category.sales)}</td>
                <td className="items-cell">{category.items.toLocaleString()}</td>
                <td className="percent-cell">
                  {((category.sales / data.totalSales) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="period-summary">
        <h4>Period Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Total Days:</span>
            <span className="summary-value">{data.dailyData.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Days with Sales:</span>
            <span className="summary-value">
              {data.dailyData.filter(d => d.sales > 0).length}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Sales Variance:</span>
            <span className="summary-value">
              {formatCurrency(data.bestDay.sales - data.worstDay.sales)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}