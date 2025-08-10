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
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!barcode.trim()) return;

    setLoading(true);
    setError("");
    setProduct(null);

    try {
      const result = await window.api.searchByUpc(barcode.trim());
      
      if (result.success && result.data) {
        setProduct(result.data);
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
    inputRef.current?.focus();
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
          <h3>Product Found</h3>
          <div className="product-details">
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
        </div>
      )}
    </div>
  );
}