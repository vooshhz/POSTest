import { useState, useEffect, useRef } from "react";
import "./InventoryList.css";

interface InventoryItem {
  id: number;
  upc: string;
  description: string | null;
  category: string | null;
  volume: string | null;
  cost: number;
  price: number;
  quantity: number;
  updated_at: string;
}

interface Product {
  upc: string;
  category: string | null;
  description: string | null;
  volume: string | null;
  pack: number | null;
}

type SortField = 'upc' | 'description' | 'category' | 'volume' | 'cost' | 'price' | 'quantity' | 'totalCost' | 'totalValue' | 'updated_at';
type SortDirection = 'asc' | 'desc';

export default function InventoryList() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [totals, setTotals] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalCost: 0,
    totalValue: 0
  });
  
  // Scanner states
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [inInventory, setInInventory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    cost: "",
    price: "",
    quantity: ""
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    setError("");
    
    try {
      const result = await window.api.getInventory();
      
      if (result.success && result.data) {
        setInventory(result.data);
        calculateTotals(result.data);
      } else {
        setError(result.error || "Failed to load inventory");
      }
    } catch (err) {
      setError("Failed to load inventory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (items: InventoryItem[]) => {
    const totals = items.reduce((acc, item) => ({
      totalItems: acc.totalItems + 1,
      totalQuantity: acc.totalQuantity + item.quantity,
      totalCost: acc.totalCost + (item.cost * item.quantity),
      totalValue: acc.totalValue + (item.price * item.quantity)
    }), {
      totalItems: 0,
      totalQuantity: 0,
      totalCost: 0,
      totalValue: 0
    });
    
    setTotals(totals);
  };

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'desc';
    
    if (sortField === field) {
      newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    }
    
    setSortField(field);
    setSortDirection(newDirection);
    
    const sortedData = [...inventory].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch(field) {
        case 'totalCost':
          aValue = a.cost * a.quantity;
          bValue = b.cost * b.quantity;
          break;
        case 'totalValue':
          aValue = a.price * a.quantity;
          bValue = b.price * b.quantity;
          break;
        case 'volume':
          aValue = parseFloat(a.volume || '0');
          bValue = parseFloat(b.volume || '0');
          break;
        default:
          aValue = a[field];
          bValue = b[field];
      }
      
      if (aValue === null) aValue = '';
      if (bValue === null) bValue = '';
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (newDirection === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
    
    setInventory(sortedData);
  };

  // Scanner functions
  const handleSearch = async () => {
    if (!barcode.trim()) return;

    setScanning(true);
    setScanError("");
    setProduct(null);
    setShowAddForm(false);

    try {
      const result = await window.api.searchByUpc(barcode.trim());
      
      if (result.success && result.data) {
        setProduct(result.data);
        setInInventory(result.inInventory || false);
      } else {
        setScanError(result.error || "Product not found");
      }
    } catch (err) {
      setScanError("Failed to search product");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setBarcode("");
    setProduct(null);
    setScanError("");
    setShowAddForm(false);
    setInventoryForm({ cost: "", price: "", quantity: "" });
    setInInventory(false);
    inputRef.current?.focus();
  };

  const handleAddToInventory = async () => {
    if (!product) return;
    
    const cost = parseFloat(inventoryForm.cost);
    const price = parseFloat(inventoryForm.price);
    const quantity = parseInt(inventoryForm.quantity);

    if (isNaN(cost) || isNaN(price) || isNaN(quantity)) {
      setScanError("Please enter valid numbers");
      return;
    }

    if (cost < 0 || price < 0 || quantity < 1) {
      setScanError("Please enter positive values");
      return;
    }

    setScanning(true);
    setScanError("");

    try {
      const result = await window.api.addToInventory({
        upc: product.upc,
        cost,
        price,
        quantity
      });

      if (result.success) {
        alert(result.message);
        setShowAddForm(false);
        setInventoryForm({ cost: "", price: "", quantity: "" });
        setInInventory(true);
        clearSearch();
        loadInventory(); // Reload the inventory list
      } else {
        setScanError(result.error || "Failed to add to inventory");
      }
    } catch (err) {
      setScanError("Failed to add to inventory");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'desc' ? ' ↓' : ' ↑';
  };

  if (loading) {
    return <div className="inventory-loading">Loading inventory...</div>;
  }

  return (
    <div className="inventory-container">
      <h2>Inventory Management</h2>
      
      {/* Scanner Section */}
      <div className="scanner-section">
        <h3>Add New Items</h3>
        <div className="scanner-input-group">
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scan or paste barcode and press Enter"
            className="scanner-input"
            disabled={scanning}
          />
          <button 
            onClick={clearSearch}
            className="clear-btn"
            title="Clear"
          >
            ✕
          </button>
        </div>

        {scanning && <div className="loading">Searching...</div>}

        {scanError && (
          <div className="error-message">
            ⚠️ {scanError}
          </div>
        )}

        {product && (
          <div className="product-info">
            <h4>Product Found {inInventory && <span className="in-inventory">✓ In Inventory</span>}</h4>
            <div className="product-details">
              <div className="detail-row">
                <span className="label">UPC:</span>
                <span className="value">{product.upc}</span>
              </div>
              <div className="detail-row">
                <span className="label">Description:</span>
                <span className="value">{product.description || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="label">Category:</span>
                <span className="value">{product.category || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="label">Volume:</span>
                <span className="value">{product.volume ? `${product.volume} mL` : "N/A"}</span>
              </div>
            </div>

            {!showAddForm && (
              <button 
                onClick={() => setShowAddForm(true)}
                className="add-inventory-btn"
              >
                {inInventory ? "Update Inventory" : "Add to Inventory"}
              </button>
            )}

            {showAddForm && (
              <div className="inventory-form">
                <h4>Inventory Details</h4>
                <div className="form-group">
                  <label>Cost ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inventoryForm.cost}
                    onChange={(e) => setInventoryForm({...inventoryForm, cost: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Price ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inventoryForm.price}
                    onChange={(e) => setInventoryForm({...inventoryForm, price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    value={inventoryForm.quantity}
                    onChange={(e) => setInventoryForm({...inventoryForm, quantity: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="form-buttons">
                  <button 
                    onClick={handleAddToInventory} 
                    className="submit-btn"
                    disabled={scanning}
                  >
                    {scanning ? "Processing..." : (inInventory ? "Update" : "Add")}
                  </button>
                  <button 
                    onClick={() => setShowAddForm(false)} 
                    className="cancel-btn"
                    disabled={scanning}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inventory Summary */}
      <div className="inventory-summary">
        <div className="summary-card">
          <span className="summary-label">Total Items</span>
          <span className="summary-value">{totals.totalItems}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Quantity</span>
          <span className="summary-value">{totals.totalQuantity}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Cost</span>
          <span className="summary-value">{formatCurrency(totals.totalCost)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Value</span>
          <span className="summary-value">{formatCurrency(totals.totalValue)}</span>
        </div>
      </div>

      {/* Inventory Table */}
      {error && <div className="inventory-error">Error: {error}</div>}
      
      {inventory.length === 0 ? (
        <div className="no-inventory">No items in inventory</div>
      ) : (
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('upc')} className="sortable">
                  UPC{getSortIndicator('upc')}
                </th>
                <th onClick={() => handleSort('description')} className="sortable">
                  Description{getSortIndicator('description')}
                </th>
                <th onClick={() => handleSort('category')} className="sortable">
                  Category{getSortIndicator('category')}
                </th>
                <th onClick={() => handleSort('volume')} className="sortable">
                  Volume{getSortIndicator('volume')}
                </th>
                <th onClick={() => handleSort('cost')} className="sortable">
                  Cost{getSortIndicator('cost')}
                </th>
                <th onClick={() => handleSort('price')} className="sortable">
                  Price{getSortIndicator('price')}
                </th>
                <th onClick={() => handleSort('quantity')} className="sortable">
                  Qty{getSortIndicator('quantity')}
                </th>
                <th onClick={() => handleSort('totalCost')} className="sortable">
                  Total Cost{getSortIndicator('totalCost')}
                </th>
                <th onClick={() => handleSort('totalValue')} className="sortable">
                  Total Value{getSortIndicator('totalValue')}
                </th>
                <th onClick={() => handleSort('updated_at')} className="sortable">
                  Updated{getSortIndicator('updated_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td className="upc-cell">{item.upc}</td>
                  <td className="description-cell">{item.description || "N/A"}</td>
                  <td>{item.category || "N/A"}</td>
                  <td>{item.volume ? `${item.volume} mL` : "N/A"}</td>
                  <td>{formatCurrency(item.cost)}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td className="quantity-cell">{item.quantity}</td>
                  <td className="total-cell">{formatCurrency(item.cost * item.quantity)}</td>
                  <td className="total-cell">{formatCurrency(item.price * item.quantity)}</td>
                  <td>{formatDate(item.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}