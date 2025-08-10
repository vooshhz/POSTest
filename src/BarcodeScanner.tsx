import React, { useState, useRef, useEffect } from "react";
import "./BarcodeScanner.css";

interface Product {
  upc: string;
  category: string | null;
  description: string | null;
  volume: string | null;
  pack: number | null;
}

export default function BarcodeScanner() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inInventory, setInInventory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    cost: "",
    price: "",
    quantity: ""
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!barcode.trim()) return;

    setLoading(true);
    setError("");
    setProduct(null);
    setShowAddForm(false);

    try {
      const result = await window.api.searchByUpc(barcode.trim());
      
      if (result.success && result.data) {
        setProduct(result.data);
        setInInventory(result.inInventory || false);
      } else {
        setError(result.error || "Product not found");
      }
    } catch (err) {
      setError("Failed to search product");
      console.error(err);
    } finally {
      setLoading(false);
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
    setError("");
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
      setError("Please enter valid numbers");
      return;
    }

    if (cost < 0 || price < 0 || quantity < 1) {
      setError("Please enter positive values");
      return;
    }

    setLoading(true);
    setError("");

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
      } else {
        setError(result.error || "Failed to add to inventory");
      }
    } catch (err) {
      setError("Failed to add to inventory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-container">
      <h2>Barcode Scanner</h2>
      
      <div className="scanner-input-group">
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Scan or paste barcode and press Enter"
          className="scanner-input"
          disabled={loading}
        />
        <button 
          onClick={clearSearch}
          className="clear-btn"
          title="Clear"
        >
          ✕
        </button>
      </div>

      {loading && <div className="loading">Searching...</div>}

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {product && (
        <div className="product-info">
          <h3>Product Found {inInventory && <span className="in-inventory">✓ In Inventory</span>}</h3>
          <div className="product-details">
            <div className="detail-row">
              <span className="label">UPC:</span>
              <span className="value">{product.upc}</span>
            </div>
            <div className="detail-row">
              <span className="label">Category:</span>
              <span className="value">{product.category || "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="label">Description:</span>
              <span className="value">{product.description || "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="label">Volume:</span>
              <span className="value">{product.volume ? `${product.volume} mL` : "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="label">Pack:</span>
              <span className="value">{product.pack || "N/A"}</span>
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
                  disabled={loading}
                >
                  {loading ? "Processing..." : (inInventory ? "Update" : "Add")}
                </button>
                <button 
                  onClick={() => setShowAddForm(false)} 
                  className="cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}