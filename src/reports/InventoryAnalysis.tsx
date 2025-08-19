import { api } from '../api/apiLayer';
import { useState, useEffect } from "react";
import "./InventoryAnalysis.css";

interface InventoryItem {
  upc: string;
  description: string;
  category: string | null;
  cost: number;
  price: number;
  quantity: number;
  value: number;
  margin: number;
  turnoverRate: number;
  daysInStock: number;
  lastSold: string | null;
}

interface InventoryMetrics {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  totalCost: number;
  avgMargin: number;
  lowStockItems: number;
  overstockItems: number;
  deadStock: number;
  fastMovers: number;
  categoryBreakdown: Array<{
    category: string;
    items: number;
    quantity: number;
    value: number;
  }>;
  stockLevels: {
    critical: number;
    low: number;
    normal: number;
    high: number;
    excess: number;
  };
}

export default function InventoryAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('value');

  useEffect(() => {
    fetchInventoryAnalysis();
  }, []);

  const fetchInventoryAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await api.getInventoryAnalysis();
      
      if (result.success && result.data) {
        setMetrics(result.data.metrics);
        setInventory(result.data.items);
      } else {
        setError(result.error || 'Failed to load inventory analysis');
      }
    } catch (err) {
      setError('Error fetching inventory analysis');
      console.error('Error:', err);
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

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return 'out-of-stock';
    if (item.quantity <= 5) return 'critical';
    if (item.quantity <= 10) return 'low';
    if (item.quantity >= 100) return 'excess';
    if (item.quantity >= 50) return 'high';
    return 'normal';
  };

  const getStockStatusLabel = (status: string) => {
    switch(status) {
      case 'out-of-stock': return 'Out of Stock';
      case 'critical': return 'Critical';
      case 'low': return 'Low Stock';
      case 'normal': return 'Normal';
      case 'high': return 'High Stock';
      case 'excess': return 'Excess';
      default: return status;
    }
  };

  const getFilteredInventory = () => {
    let filtered = [...inventory];
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => 
        (item.category || 'Uncategorized') === filterCategory
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        getStockStatus(item) === filterStatus
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'value':
          return b.value - a.value;
        case 'quantity':
          return b.quantity - a.quantity;
        case 'margin':
          return b.margin - a.margin;
        case 'turnover':
          return b.turnoverRate - a.turnoverRate;
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="inventory-analysis-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing inventory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inventory-analysis-container">
        <div className="inventory-analysis-error">{error}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="inventory-analysis-container">
        <div className="no-data">No inventory data available</div>
      </div>
    );
  }

  const categories = Array.from(new Set(inventory.map(i => i.category || 'Uncategorized')));
  const filteredInventory = getFilteredInventory();

  return (
    <div className="inventory-analysis-container">
      <div className="inventory-analysis-header">
        <h3>Inventory Analysis</h3>
        <button onClick={fetchInventoryAnalysis} className="refresh-btn">
          ↻ Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="inventory-metrics">
        <div className="metric-card">
          <div className="metric-label">Total Inventory Value</div>
          <div className="metric-value primary">{formatCurrency(metrics.totalValue)}</div>
          <div className="metric-detail">Cost: {formatCurrency(metrics.totalCost)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Items</div>
          <div className="metric-value">{metrics.totalItems.toLocaleString()}</div>
          <div className="metric-detail">{metrics.totalQuantity.toLocaleString()} units</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Average Margin</div>
          <div className="metric-value">{metrics.avgMargin.toFixed(1)}%</div>
          <div className="metric-detail">Profit: {formatCurrency(metrics.totalValue - metrics.totalCost)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Low Stock Alert</div>
          <div className="metric-value warning">{metrics.lowStockItems}</div>
          <div className="metric-detail">Items need reordering</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Dead Stock</div>
          <div className="metric-value danger">{metrics.deadStock}</div>
          <div className="metric-detail">No sales in 30+ days</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Fast Movers</div>
          <div className="metric-value success">{metrics.fastMovers}</div>
          <div className="metric-detail">High turnover items</div>
        </div>
      </div>

      {/* Stock Level Distribution */}
      <div className="stock-distribution">
        <h4>Stock Level Distribution</h4>
        <div className="distribution-bars">
          <div className="dist-bar critical" style={{ flex: metrics.stockLevels.critical }}>
            <span className="dist-label">Critical ({metrics.stockLevels.critical})</span>
          </div>
          <div className="dist-bar low" style={{ flex: metrics.stockLevels.low }}>
            <span className="dist-label">Low ({metrics.stockLevels.low})</span>
          </div>
          <div className="dist-bar normal" style={{ flex: metrics.stockLevels.normal }}>
            <span className="dist-label">Normal ({metrics.stockLevels.normal})</span>
          </div>
          <div className="dist-bar high" style={{ flex: metrics.stockLevels.high }}>
            <span className="dist-label">High ({metrics.stockLevels.high})</span>
          </div>
          <div className="dist-bar excess" style={{ flex: metrics.stockLevels.excess }}>
            <span className="dist-label">Excess ({metrics.stockLevels.excess})</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="category-breakdown">
        <h4>Category Analysis</h4>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Items</th>
              <th>Quantity</th>
              <th>Value</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.categoryBreakdown.map((cat, index) => (
              <tr key={index}>
                <td>{cat.category}</td>
                <td>{cat.items}</td>
                <td>{cat.quantity.toLocaleString()}</td>
                <td className="value-cell">{formatCurrency(cat.value)}</td>
                <td>
                  <div className="percentage-bar">
                    <div 
                      className="percentage-fill"
                      style={{ width: `${(cat.value / metrics.totalValue) * 100}%` }}
                    />
                    <span className="percentage-text">
                      {((cat.value / metrics.totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inventory Items Table with Filters */}
      <div className="inventory-items">
        <div className="items-header">
          <h4>Inventory Items</h4>
          <div className="filters">
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Stock Levels</option>
              <option value="critical">Critical</option>
              <option value="low">Low Stock</option>
              <option value="normal">Normal</option>
              <option value="high">High Stock</option>
              <option value="excess">Excess</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="value">Sort by Value</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="margin">Sort by Margin</option>
              <option value="turnover">Sort by Turnover</option>
            </select>
          </div>
        </div>

        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>UPC</th>
                <th>Description</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Cost</th>
                <th>Price</th>
                <th>Value</th>
                <th>Margin</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.slice(0, 50).map((item, index) => (
                <tr key={index}>
                  <td className="upc-cell">{item.upc}</td>
                  <td>{item.description}</td>
                  <td>{item.category || 'Uncategorized'}</td>
                  <td className="quantity-cell">{item.quantity}</td>
                  <td>{formatCurrency(item.cost)}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td className="value-cell">{formatCurrency(item.value)}</td>
                  <td className="margin-cell">{item.margin.toFixed(1)}%</td>
                  <td>
                    <span className={`status-badge ${getStockStatus(item)}`}>
                      {getStockStatusLabel(getStockStatus(item))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInventory.length > 50 && (
            <div className="table-footer">
              Showing 50 of {filteredInventory.length} items
            </div>
          )}
        </div>
      </div>
    </div>
  );
}