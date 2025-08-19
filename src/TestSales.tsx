import { api } from './api/apiLayer';
import { useState } from "react";
import "./TestSales.css";

export default function TestSales() {
  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [formData, setFormData] = useState({
    numberOfSales: "5",
    minItemsPerSale: "1",
    maxItemsPerSale: "5",
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    paymentTypes: {
      cash: true,
      debit: true,
      credit: true
    }
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    salesCreated?: number;
    salesFailed?: number;
    totalItems?: number;
    totalValue?: number;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentTypeChange = (type: 'cash' | 'debit' | 'credit') => {
    setFormData(prev => ({
      ...prev,
      paymentTypes: {
        ...prev.paymentTypes,
        [type]: !prev.paymentTypes[type]
      }
    }));
  };

  const validateForm = () => {
    const numberOfSales = parseInt(formData.numberOfSales);
    const minItems = parseInt(formData.minItemsPerSale);
    const maxItems = parseInt(formData.maxItemsPerSale);
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (isNaN(numberOfSales) || numberOfSales < 1 || numberOfSales > 100) {
      alert("Number of sales must be between 1 and 100");
      return false;
    }

    if (isNaN(minItems) || isNaN(maxItems) || minItems < 1 || maxItems < minItems) {
      alert("Invalid item range. Max items must be greater than or equal to min items.");
      return false;
    }

    if (maxItems > 20) {
      alert("Maximum items per sale cannot exceed 20");
      return false;
    }

    // Validate date range
    if (startDate > endDate) {
      alert("Start date must be before or equal to end date");
      return false;
    }

    if (endDate > new Date()) {
      alert("End date cannot be in the future");
      return false;
    }

    // Check at least one payment type is selected
    const selectedPayments = Object.values(formData.paymentTypes).filter(v => v);
    if (selectedPayments.length === 0) {
      alert("Please select at least one payment type");
      return false;
    }

    return true;
  };

  const handleGenerateSales = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setResult(null);

    try {
      // Get enabled payment types
      const enabledPaymentTypes = Object.entries(formData.paymentTypes)
        .filter(([_, enabled]) => enabled)
        .map(([type, _]) => type);

      const params = {
        numberOfSales: parseInt(formData.numberOfSales),
        minItemsPerSale: parseInt(formData.minItemsPerSale),
        maxItemsPerSale: parseInt(formData.maxItemsPerSale),
        startDate: formData.startDate,
        endDate: formData.endDate,
        paymentTypes: enabledPaymentTypes
      };

      const response = await api.generateTestSales(params);

      if (response.success) {
        setResult({
          success: true,
          message: `Successfully created ${response.salesCreated || 0} test sales!`,
          salesCreated: response.salesCreated,
          salesFailed: 0,
          totalItems: response.totalItems,
          totalValue: response.totalValue
        });
        
        // Only reset form if some sales were created
        if (response.salesCreated && response.salesCreated > 0) {
          setTimeout(() => {
            setFormData({
              numberOfSales: "5",
              minItemsPerSale: "1",
              maxItemsPerSale: "5",
              startDate: formData.startDate,
              endDate: formData.endDate,
              paymentTypes: {
                cash: true,
                debit: true,
                credit: true
              }
            });
          }, 2000);
        }
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to generate test sales"
        });
      }
    } catch (error) {
      console.error("Error generating test sales:", error);
      setResult({
        success: false,
        message: "An error occurred while generating test sales"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearTransactions = async () => {
    if (!confirm("Are you sure you want to clear ALL transactions? This cannot be undone!")) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.clearTransactions();
      if (response.success) {
        setResult({
          success: true,
          message: "All transactions cleared successfully!"
        });
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to clear transactions"
        });
      }
    } catch (error) {
      console.error("Error clearing transactions:", error);
      setResult({
        success: false,
        message: "An error occurred while clearing transactions"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="test-sales-container">
      <div className="test-sales-header">
        <h3>Generate Test Sales</h3>
        <p>Create test transactions to simulate sales activity</p>
      </div>

      <div className="test-form">
        <div className="form-row">
          <div className="form-group">
            <label>Number of Sales</label>
            <input
              type="number"
              name="numberOfSales"
              value={formData.numberOfSales}
              onChange={handleInputChange}
              min="1"
              max="100"
              disabled={loading}
            />
            <span className="help-text">How many test sales to create (1-100)</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Items Per Sale Range</label>
            <div className="range-inputs">
              <input
                type="number"
                name="minItemsPerSale"
                value={formData.minItemsPerSale}
                onChange={handleInputChange}
                min="1"
                max="20"
                placeholder="Min"
                disabled={loading}
              />
              <span className="range-separator">to</span>
              <input
                type="number"
                name="maxItemsPerSale"
                value={formData.maxItemsPerSale}
                onChange={handleInputChange}
                min="1"
                max="20"
                placeholder="Max"
                disabled={loading}
              />
            </div>
            <span className="help-text">Random number of items per sale within this range</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date Range</label>
            <div className="date-inputs">
              <div className="date-input-wrapper">
                <label className="date-label">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  max={formData.endDate}
                  disabled={loading}
                  className="date-input"
                />
              </div>
              <span className="date-separator">to</span>
              <div className="date-input-wrapper">
                <label className="date-label">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={formData.startDate}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                  className="date-input"
                />
              </div>
            </div>
            <span className="help-text">Sales will be distributed randomly across this date range</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Payment Types</label>
            <div className="payment-types">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.paymentTypes.cash}
                  onChange={() => handlePaymentTypeChange('cash')}
                  disabled={loading}
                />
                <span>Cash</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.paymentTypes.debit}
                  onChange={() => handlePaymentTypeChange('debit')}
                  disabled={loading}
                />
                <span>Debit</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.paymentTypes.credit}
                  onChange={() => handlePaymentTypeChange('credit')}
                  disabled={loading}
                />
                <span>Credit</span>
              </label>
            </div>
            <span className="help-text">Sales will randomly use selected payment types</span>
          </div>
        </div>

        <div className="preview-box">
          <h4>Preview</h4>
          <p>Will generate <strong>{formData.numberOfSales}</strong> sales with:</p>
          <ul>
            <li>{formData.minItemsPerSale}-{formData.maxItemsPerSale} items per sale</li>
            <li>Date range: {new Date(formData.startDate).toLocaleDateString()} to {new Date(formData.endDate).toLocaleDateString()}</li>
            <li>Payment types: {Object.entries(formData.paymentTypes)
              .filter(([_, enabled]) => enabled)
              .map(([type, _]) => type)
              .join(', ') || 'None selected'}</li>
            <li>Items randomly selected from current inventory</li>
            <li>Each sale will deduct from inventory and create adjustments</li>
          </ul>
        </div>

        {result && (
          <div className={`result-message ${result.success ? 'success' : 'error'}`}>
            {result.success ? '✅' : '❌'} {result.message}
            {result.success && (
              <div className="result-details">
                {result.salesCreated !== undefined && (
                  <span>Sales created: {result.salesCreated}</span>
                )}
                {result.salesFailed !== undefined && result.salesFailed > 0 && (
                  <span className="failed-sales">Failed: {result.salesFailed}</span>
                )}
                {result.totalItems !== undefined && result.totalItems > 0 && (
                  <span>Items sold: {result.totalItems}</span>
                )}
                {result.totalValue !== undefined && result.totalValue > 0 && (
                  <span>Total value: ${result.totalValue.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="action-buttons">
          <button
            className="generate-btn"
            onClick={handleGenerateSales}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Test Sales"}
          </button>
          
          <button
            className="clear-btn"
            onClick={handleClearTransactions}
            disabled={loading}
          >
            Clear All Transactions
          </button>
        </div>

        <div className="warning-box">
          <strong>⚠️ Warning:</strong> Test sales will:
          <ul>
            <li>Deduct items from your current inventory</li>
            <li>Create real transaction records</li>
            <li>Generate inventory adjustment entries</li>
            <li>Affect all reports and statistics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}