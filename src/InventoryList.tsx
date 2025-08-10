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

interface InventoryListProps {
  barcode: string;
  setBarcode: (value: string) => void;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
}

export default function InventoryList({ barcode, setBarcode, searchFilter, setSearchFilter }: InventoryListProps) {
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
  const [product, setProduct] = useState<Product | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [inInventory, setInInventory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    cost: "",
    price: "",
    quantity: ""
  });
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
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
    setShowAddModal(false);

    try {
      const result = await window.api.searchByUpc(barcode.trim());
      console.log("Search result:", result); // Debug log
      
      if (result.success && result.data) {
        setProduct(result.data);
        setInInventory(result.inInventory || false);
        
        if (result.inInventory) {
          // If in inventory, just filter the table
          setSearchFilter(barcode.trim());
        } else {
          // If not in inventory, open the modal
          console.log("Opening modal for non-inventory item"); // Debug log
          setShowAddModal(true);
        }
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
    setShowAddModal(false);
    setInventoryForm({ cost: "", price: "", quantity: "" });
    setInInventory(false);
    setSearchFilter(""); // Clear the filter
    inputRef.current?.focus();
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setInventoryForm({ cost: "", price: "", quantity: "" });
  };

  // Handle ESC key for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddModal) closeAddModal();
        if (editingItem) closeEditModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAddModal, editingItem]);

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
        closeAddModal();
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

  // Filter inventory based on search
  const filteredInventory = searchFilter 
    ? inventory.filter(item => item.upc.includes(searchFilter))
    : inventory;

  // Handle edit modal
  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      cost: item.cost.toString(),
      price: item.price.toString(),
      quantity: item.quantity.toString()
    });
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditForm({ cost: "", price: "", quantity: "" });
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    
    const cost = parseFloat(editForm.cost);
    const price = parseFloat(editForm.price);
    const quantity = parseInt(editForm.quantity);

    if (isNaN(cost) || isNaN(price) || isNaN(quantity)) {
      alert("Please enter valid numbers");
      return;
    }

    if (cost < 0 || price < 0 || quantity < 0) {
      alert("Please enter positive values");
      return;
    }

    try {
      const result = await window.api.addToInventory({
        upc: editingItem.upc,
        cost,
        price,
        quantity
      });

      if (result.success) {
        closeEditModal();
        loadInventory();
      } else {
        alert(result.error || "Failed to update item");
      }
    } catch (err) {
      alert("Failed to update item");
      console.error(err);
    }
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

        {product && inInventory && (
          <div className="in-inventory-notice">
            ✓ Item found in inventory - showing filtered results below
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
      
      {searchFilter && (
        <div className="filter-notice">
          Showing results for UPC: {searchFilter} 
          <button onClick={() => setSearchFilter("")} className="clear-filter-btn">Show All</button>
        </div>
      )}
      
      {filteredInventory.length === 0 ? (
        <div className="no-inventory">
          {searchFilter ? `No items found for UPC: ${searchFilter}` : "No items in inventory"}
        </div>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
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
                  <td>
                    <button onClick={() => openEditModal(item)} className="modify-btn">Modify</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Modify Inventory Item</h3>
            <div className="modal-item-info">
              <p><strong>UPC:</strong> {editingItem.upc}</p>
              <p><strong>Description:</strong> {editingItem.description || "N/A"}</p>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Cost ($):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.cost}
                  onChange={(e) => setEditForm({...editForm, cost: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Price ($):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.price}
                  onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Quantity:</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="modal-buttons">
                <button onClick={handleUpdateItem} className="save-btn">Save</button>
                <button onClick={closeEditModal} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add to Inventory Modal */}
      {console.log("Modal state:", { showAddModal, product })}
      {showAddModal && product && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add to Inventory</h3>
              <button className="modal-close-btn" onClick={closeAddModal}>×</button>
            </div>
            <div className="modal-item-info">
              <p><strong>UPC:</strong> {product.upc}</p>
              <p><strong>Description:</strong> {product.description || "N/A"}</p>
              <p><strong>Category:</strong> {product.category || "N/A"}</p>
              <p><strong>Volume:</strong> {product.volume ? `${product.volume} mL` : "N/A"}</p>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Cost ($):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inventoryForm.cost}
                  onChange={(e) => setInventoryForm({...inventoryForm, cost: e.target.value})}
                  placeholder="0.00"
                  autoFocus
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
              <div className="modal-buttons">
                <button onClick={handleAddToInventory} className="save-btn" disabled={scanning}>
                  {scanning ? "Processing..." : "Add"}
                </button>
                <button onClick={closeAddModal} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}