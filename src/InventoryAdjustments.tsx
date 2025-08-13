import { useState, useEffect } from "react";
import "./InventoryAdjustments.css";

interface InventoryAdjustment {
  id: number;
  upc: string;
  description: string;
  category: string | null;
  adjustment_type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  cost: number | null;
  price: number | null;
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string;
  created_at_local: string;
}

export default function InventoryAdjustments() {
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchUPC, setSearchUPC] = useState("");

  useEffect(() => {
    loadAdjustments();
  }, [filterType]);

  const loadAdjustments = async () => {
    setLoading(true);
    setError("");
    
    try {
      const filters: any = {};
      if (filterType !== "all") {
        filters.type = filterType;
      }
      if (searchUPC) {
        filters.upc = searchUPC;
      }
      
      const result = await window.api.getInventoryAdjustments(filters);
      
      if (result.success && result.data) {
        setAdjustments(result.data);
      } else {
        setError(result.error || "Failed to load adjustments");
      }
    } catch (err) {
      setError("Failed to load adjustments");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadAdjustments();
  };

  const formatQuantityChange = (change: number) => {
    if (change > 0) {
      return <span className="positive-change">+{change}</span>;
    } else if (change < 0) {
      return <span className="negative-change">{change}</span>;
    }
    return <span>{change}</span>;
  };

  const getAdjustmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'purchase': 'Purchase',
      'sale': 'Sale',
      'adjustment': 'Manual Adjustment',
      'initial': 'Initial Stock',
      'test_data': 'Test Data',
      'return': 'Return',
      'damage': 'Damage',
      'theft': 'Theft'
    };
    return labels[type] || type;
  };

  const getAdjustmentTypeClass = (type: string) => {
    const classes: Record<string, string> = {
      'purchase': 'type-purchase',
      'sale': 'type-sale',
      'adjustment': 'type-adjustment',
      'initial': 'type-initial',
      'test_data': 'type-test',
      'return': 'type-return',
      'damage': 'type-damage',
      'theft': 'type-theft'
    };
    return classes[type] || '';
  };

  // Calculate summary statistics
  const summary = adjustments.reduce((acc, adj) => {
    if (adj.quantity_change > 0) {
      acc.totalIn += adj.quantity_change;
      acc.countIn++;
    } else if (adj.quantity_change < 0) {
      acc.totalOut += Math.abs(adj.quantity_change);
      acc.countOut++;
    }
    return acc;
  }, { totalIn: 0, totalOut: 0, countIn: 0, countOut: 0 });

  if (loading) {
    return (
      <div className="adjustments-loading">
        <div className="loading-spinner"></div>
        <p>Loading adjustments...</p>
      </div>
    );
  }

  return (
    <div className="adjustments-container">
      <div className="adjustments-header">
        <h3>Inventory Adjustments</h3>
        <div className="adjustments-summary">
          <div className="summary-card in">
            <span className="summary-label">Total In</span>
            <span className="summary-value">+{summary.totalIn}</span>
            <span className="summary-count">{summary.countIn} entries</span>
          </div>
          <div className="summary-card out">
            <span className="summary-label">Total Out</span>
            <span className="summary-value">-{summary.totalOut}</span>
            <span className="summary-count">{summary.countOut} entries</span>
          </div>
          <div className="summary-card net">
            <span className="summary-label">Net Change</span>
            <span className="summary-value">{summary.totalIn - summary.totalOut}</span>
            <span className="summary-count">{adjustments.length} total</span>
          </div>
        </div>
      </div>

      <div className="adjustments-filters">
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="purchase">Purchases</option>
            <option value="sale">Sales</option>
            <option value="test_data">Test Data</option>
            <option value="adjustment">Manual Adjustments</option>
            <option value="return">Returns</option>
            <option value="damage">Damage</option>
            <option value="theft">Theft</option>
          </select>
        </div>
        <div className="filter-group">
          <label>UPC:</label>
          <input
            type="text"
            value={searchUPC}
            onChange={(e) => setSearchUPC(e.target.value)}
            placeholder="Filter by UPC"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>Search</button>
        </div>
      </div>

      {error && (
        <div className="adjustments-error">
          {error}
        </div>
      )}

      <div className="adjustments-table-container">
        <table className="adjustments-table">
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Type</th>
              <th>UPC</th>
              <th>Description</th>
              <th>Change</th>
              <th>Before → After</th>
              <th>Cost</th>
              <th>Price</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={9} className="no-data">No adjustments found</td>
              </tr>
            ) : (
              adjustments.map((adj) => (
                <tr key={adj.id} data-movement={adj.quantity_change >= 0 ? 'in' : 'out'}>
                  <td className="date-cell">
                    {new Date(adj.created_at_local).toLocaleString()}
                  </td>
                  <td>
                    <span className={`adjustment-type ${getAdjustmentTypeClass(adj.adjustment_type)}`}>
                      {getAdjustmentTypeLabel(adj.adjustment_type)}
                    </span>
                  </td>
                  <td className="upc-cell">{adj.upc}</td>
                  <td className="description-cell">
                    <div className="item-description">{adj.description}</div>
                    {adj.category && <div className="item-category">{adj.category}</div>}
                  </td>
                  <td className="quantity-cell">
                    {formatQuantityChange(adj.quantity_change)}
                  </td>
                  <td className="stock-cell">
                    <span style={{ color: adj.quantity_change < 0 ? '#f44336' : '#4CAF50' }}>
                      {adj.quantity_before} → {adj.quantity_after}
                    </span>
                  </td>
                  <td className="cost-cell">
                    {adj.cost !== null ? `$${adj.cost.toFixed(2)}` : '-'}
                  </td>
                  <td className="price-cell">
                    {adj.price !== null ? `$${adj.price.toFixed(2)}` : '-'}
                  </td>
                  <td className="notes-cell">
                    {adj.notes || '-'}
                    {adj.reference_type === 'transaction' && adj.reference_id && (
                      <div className="reference-link">
                        Trans #{adj.reference_id}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}