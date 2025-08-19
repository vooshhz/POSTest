import { api } from '../api/apiLayer';
import { useState, useEffect } from 'react';
import './Replenishment.css';

interface InventoryItem {
  upc: string;
  description: string;
  category: string | null;
  quantity: number;
  cost: number;
  price: number;
  daily_velocity?: number;
  days_remaining?: number;
  last_sale_date?: string;
}

interface SalesVelocity {
  upc: string;
  daily_average: number;
  weekly_average: number;
  monthly_average: number;
  last_30_days_sold: number;
}

export default function Replenishment() {
  const [outOfStock, setOutOfStock] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState(7); // Days of inventory
  const [selectedTimeframe, setSelectedTimeframe] = useState<'7' | '14' | '30'>('7');

  useEffect(() => {
    loadReplenishmentData();
  }, [lowStockThreshold, selectedTimeframe]);

  const loadReplenishmentData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current inventory
      const inventoryResult = await api.getInventory();
      if (!inventoryResult.success || !inventoryResult.data) {
        throw new Error('Failed to load inventory');
      }

      // Get recent transactions to calculate velocity
      const transactionsResult = await api.getTransactions();
      if (!transactionsResult.success || !transactionsResult.data) {
        throw new Error('Failed to load transactions');
      }

      // Calculate sales velocity for each item
      const velocityMap = calculateSalesVelocity(transactionsResult.data, parseInt(selectedTimeframe));
      
      // Categorize items
      const outOfStockItems: InventoryItem[] = [];
      const lowStockItems: InventoryItem[] = [];
      
      inventoryResult.data.forEach((item: any) => {
        const velocity = velocityMap.get(item.upc);
        const dailyVelocity = velocity?.daily_average || 0;
        
        const enrichedItem: InventoryItem = {
          ...item,
          daily_velocity: dailyVelocity,
          days_remaining: dailyVelocity > 0 ? Math.floor(item.quantity / dailyVelocity) : 999,
          last_sale_date: velocity?.last_sale_date
        };
        
        if (item.quantity === 0) {
          outOfStockItems.push(enrichedItem);
        } else if (dailyVelocity > 0 && enrichedItem.days_remaining! <= lowStockThreshold) {
          lowStockItems.push(enrichedItem);
        }
      });
      
      // Sort by urgency
      outOfStockItems.sort((a, b) => (b.daily_velocity || 0) - (a.daily_velocity || 0));
      lowStockItems.sort((a, b) => (a.days_remaining || 999) - (b.days_remaining || 999));
      
      setOutOfStock(outOfStockItems);
      setLowStock(lowStockItems);
    } catch (err) {
      console.error('Error loading replenishment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load replenishment data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSalesVelocity = (transactions: any[], daysToAnalyze: number): Map<string, SalesVelocity & { last_sale_date?: string }> => {
    const velocityMap = new Map<string, SalesVelocity & { last_sale_date?: string }>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
    
    // Track sales by UPC
    const salesByUpc = new Map<string, { total: number; dates: Date[] }>();
    
    transactions.forEach((transaction: any) => {
      const transDate = new Date(transaction.created_at);
      if (transDate < cutoffDate) return;
      
      try {
        const items = JSON.parse(transaction.items);
        items.forEach((item: any) => {
          if (!item.upc) return;
          
          const current = salesByUpc.get(item.upc) || { total: 0, dates: [] };
          current.total += item.quantity || 1;
          current.dates.push(transDate);
          salesByUpc.set(item.upc, current);
        });
      } catch (e) {
        console.error('Error parsing transaction items:', e);
      }
    });
    
    // Calculate velocities
    salesByUpc.forEach((sales, upc) => {
      const dailyAverage = sales.total / daysToAnalyze;
      const lastSaleDate = sales.dates.length > 0 
        ? sales.dates.sort((a, b) => b.getTime() - a.getTime())[0].toISOString()
        : undefined;
      
      velocityMap.set(upc, {
        upc,
        daily_average: dailyAverage,
        weekly_average: dailyAverage * 7,
        monthly_average: dailyAverage * 30,
        last_30_days_sold: sales.total,
        last_sale_date: lastSaleDate
      });
    });
    
    return velocityMap;
  };

  const formatDaysRemaining = (days: number | undefined) => {
    if (!days || days === 999) return 'N/A';
    if (days === 0) return 'Out Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const formatLastSale = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getReorderQuantity = (item: InventoryItem) => {
    if (!item.daily_velocity) return 0;
    // Suggest 30 days of inventory as reorder quantity
    return Math.ceil(item.daily_velocity * 30);
  };

  if (loading) {
    return <div className="replenishment-loading">Loading replenishment data...</div>;
  }

  if (error) {
    return <div className="replenishment-error">Error: {error}</div>;
  }

  return (
    <div className="replenishment-container">
      <div className="replenishment-header">
        <h3>Inventory Replenishment</h3>
        <div className="replenishment-controls">
          <div className="control-group">
            <label>Analysis Period:</label>
            <select 
              value={selectedTimeframe} 
              onChange={(e) => setSelectedTimeframe(e.target.value as '7' | '14' | '30')}
              className="timeframe-select"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          </div>
          <div className="control-group">
            <label>Low Stock Alert (days):</label>
            <input
              type="number"
              min="1"
              max="30"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value))}
              className="threshold-input"
            />
          </div>
        </div>
      </div>

      {/* Out of Stock Section */}
      <div className="replenishment-section">
        <div className="section-header out-of-stock-header">
          <h4>🔴 Out of Stock ({outOfStock.length} items)</h4>
          {outOfStock.length > 0 && (
            <span className="urgency-badge critical">Immediate Action Required</span>
          )}
        </div>
        {outOfStock.length === 0 ? (
          <div className="no-items">No items are currently out of stock</div>
        ) : (
          <div className="replenishment-table-wrapper">
            <table className="replenishment-table">
              <thead>
                <tr>
                  <th>UPC</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Daily Sales</th>
                  <th>Last Sold</th>
                  <th>Suggested Reorder</th>
                  <th>Reorder Value</th>
                </tr>
              </thead>
              <tbody>
                {outOfStock.map((item) => (
                  <tr key={item.upc} className="out-of-stock-row">
                    <td className="upc-cell">{item.upc}</td>
                    <td className="description-cell">{item.description}</td>
                    <td className="category-cell">{item.category || 'N/A'}</td>
                    <td className="velocity-cell">
                      {item.daily_velocity ? item.daily_velocity.toFixed(1) : '0'}
                    </td>
                    <td className="last-sale-cell">{formatLastSale(item.last_sale_date)}</td>
                    <td className="reorder-qty-cell">{getReorderQuantity(item)} units</td>
                    <td className="reorder-value-cell">
                      ${(getReorderQuantity(item) * item.cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low Stock Section */}
      <div className="replenishment-section">
        <div className="section-header low-stock-header">
          <h4>⚠️ Low Stock ({lowStock.length} items)</h4>
          {lowStock.length > 0 && (
            <span className="urgency-badge warning">
              Running out within {lowStockThreshold} days
            </span>
          )}
        </div>
        {lowStock.length === 0 ? (
          <div className="no-items">No items are currently low on stock</div>
        ) : (
          <div className="replenishment-table-wrapper">
            <table className="replenishment-table">
              <thead>
                <tr>
                  <th>UPC</th>
                  <th>Description</th>
                  <th>Current Stock</th>
                  <th>Daily Sales</th>
                  <th>Days Remaining</th>
                  <th>Last Sold</th>
                  <th>Suggested Reorder</th>
                  <th>Reorder Value</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => (
                  <tr key={item.upc} className={item.days_remaining! <= 3 ? 'critical-row' : 'warning-row'}>
                    <td className="upc-cell">{item.upc}</td>
                    <td className="description-cell">{item.description}</td>
                    <td className="stock-cell">{item.quantity}</td>
                    <td className="velocity-cell">
                      {item.daily_velocity ? item.daily_velocity.toFixed(1) : '0'}
                    </td>
                    <td className="days-remaining-cell">
                      <span className={`days-badge ${item.days_remaining! <= 3 ? 'critical' : 'warning'}`}>
                        {formatDaysRemaining(item.days_remaining)}
                      </span>
                    </td>
                    <td className="last-sale-cell">{formatLastSale(item.last_sale_date)}</td>
                    <td className="reorder-qty-cell">{getReorderQuantity(item)} units</td>
                    <td className="reorder-value-cell">
                      ${(getReorderQuantity(item) * item.cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="replenishment-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="stat-label">Total Items Needing Reorder:</span>
            <span className="stat-value">{outOfStock.length + lowStock.length}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Total Reorder Value:</span>
            <span className="stat-value">
              ${[...outOfStock, ...lowStock]
                .reduce((sum, item) => sum + (getReorderQuantity(item) * item.cost), 0)
                .toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}