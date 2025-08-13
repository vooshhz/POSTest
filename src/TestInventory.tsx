import { useState } from "react";
import "./TestInventory.css";

export default function TestInventory() {
  const [formData, setFormData] = useState({
    itemCount: "10",
    minCost: "5",
    maxCost: "50",
    markupPercentage: "25",
    minQuantity: "5",
    maxQuantity: "10"
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    itemsAdded?: number;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const itemCount = parseInt(formData.itemCount);
    const minCost = parseFloat(formData.minCost);
    const maxCost = parseFloat(formData.maxCost);
    const markup = parseFloat(formData.markupPercentage);
    const minQty = parseInt(formData.minQuantity);
    const maxQty = parseInt(formData.maxQuantity);

    if (isNaN(itemCount) || itemCount < 1 || itemCount > 100) {
      alert("Item count must be between 1 and 100");
      return false;
    }

    if (isNaN(minCost) || isNaN(maxCost) || minCost < 0 || maxCost < minCost) {
      alert("Invalid cost range. Max cost must be greater than min cost.");
      return false;
    }

    if (isNaN(markup) || markup < 0 || markup > 500) {
      alert("Markup percentage must be between 0 and 500");
      return false;
    }

    if (isNaN(minQty) || isNaN(maxQty) || minQty < 1 || maxQty < minQty) {
      alert("Invalid quantity range. Max quantity must be greater than min quantity.");
      return false;
    }

    return true;
  };

  const handleGenerate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setResult(null);

    try {
      const params = {
        itemCount: parseInt(formData.itemCount),
        minCost: parseFloat(formData.minCost),
        maxCost: parseFloat(formData.maxCost),
        markupPercentage: parseFloat(formData.markupPercentage),
        minQuantity: parseInt(formData.minQuantity),
        maxQuantity: parseInt(formData.maxQuantity)
      };

      const response = await window.api.generateTestInventory(params);

      if (response.success) {
        setResult({
          success: true,
          message: `Successfully added ${response.itemsAdded} items to inventory!`,
          itemsAdded: response.itemsAdded
        });
        
        // Reset form after successful generation
        setTimeout(() => {
          setFormData({
            itemCount: "10",
            minCost: "5",
            maxCost: "50",
            markupPercentage: "25",
            minQuantity: "5",
            maxQuantity: "10"
          });
        }, 2000);
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to generate test inventory"
        });
      }
    } catch (error) {
      console.error("Error generating test inventory:", error);
      setResult({
        success: false,
        message: "An error occurred while generating test inventory"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearInventory = async () => {
    if (!confirm("Are you sure you want to clear ALL inventory? This cannot be undone!")) {
      return;
    }

    setLoading(true);
    try {
      const response = await window.api.clearInventory();
      if (response.success) {
        setResult({
          success: true,
          message: "Inventory cleared successfully!"
        });
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to clear inventory"
        });
      }
    } catch (error) {
      console.error("Error clearing inventory:", error);
      setResult({
        success: false,
        message: "An error occurred while clearing inventory"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="test-inventory-container">
      <div className="test-inventory-header">
        <h3>Generate Test Inventory</h3>
        <p>Quickly populate inventory with random products for testing</p>
      </div>

      <div className="test-form">
        <div className="form-row">
          <div className="form-group">
            <label>Number of Items</label>
            <input
              type="number"
              name="itemCount"
              value={formData.itemCount}
              onChange={handleInputChange}
              min="1"
              max="100"
              disabled={loading}
            />
            <span className="help-text">How many random items to add (1-100)</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cost Range ($)</label>
            <div className="range-inputs">
              <input
                type="number"
                name="minCost"
                value={formData.minCost}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="Min"
                disabled={loading}
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                name="maxCost"
                value={formData.maxCost}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="Max"
                disabled={loading}
              />
            </div>
            <span className="help-text">Random cost will be generated within this range</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Markup Percentage (%)</label>
            <input
              type="number"
              name="markupPercentage"
              value={formData.markupPercentage}
              onChange={handleInputChange}
              min="0"
              max="500"
              step="0.1"
              disabled={loading}
            />
            <span className="help-text">Selling price = Cost + (Cost × Markup%)</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Quantity Range</label>
            <div className="range-inputs">
              <input
                type="number"
                name="minQuantity"
                value={formData.minQuantity}
                onChange={handleInputChange}
                min="1"
                placeholder="Min"
                disabled={loading}
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                name="maxQuantity"
                value={formData.maxQuantity}
                onChange={handleInputChange}
                min="1"
                placeholder="Max"
                disabled={loading}
              />
            </div>
            <span className="help-text">Random quantity will be generated within this range</span>
          </div>
        </div>

        <div className="preview-box">
          <h4>Preview</h4>
          <p>Will generate <strong>{formData.itemCount}</strong> random items with:</p>
          <ul>
            <li>Cost: ${formData.minCost} - ${formData.maxCost}</li>
            <li>Price: Cost + {formData.markupPercentage}%</li>
            <li>Quantity: {formData.minQuantity} - {formData.maxQuantity} units</li>
          </ul>
        </div>

        {result && (
          <div className={`result-message ${result.success ? 'success' : 'error'}`}>
            {result.success ? '✅' : '❌'} {result.message}
          </div>
        )}

        <div className="action-buttons">
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Test Inventory"}
          </button>
          
          <button
            className="clear-btn"
            onClick={handleClearInventory}
            disabled={loading}
          >
            Clear All Inventory
          </button>
        </div>
      </div>
    </div>
  );
}