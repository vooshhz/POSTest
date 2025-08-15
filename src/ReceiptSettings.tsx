import { useState, useEffect } from "react";
import "./ReceiptSettings.css";

interface StoreInfo {
  store_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  tax_rate: number;
  receipt_header?: string;
  receipt_footer?: string;
}

export default function ReceiptSettings() {
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<'desktop' | 'receipt'>('desktop');

  useEffect(() => {
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    setLoading(true);
    try {
      const result = await window.api.getStoreInfo();
      if (result.success && result.data) {
        setStoreInfo(result.data);
        setReceiptHeader(result.data.receipt_header || "");
        setReceiptFooter(result.data.receipt_footer || "Thank you for your business!");
      }
    } catch (err) {
      setError("Failed to load store information");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeInfo) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updatedInfo = {
        ...storeInfo,
        receipt_header: receiptHeader,
        receipt_footer: receiptFooter
      };

      const result = await window.api.saveStoreInfo(updatedInfo);
      if (result.success) {
        setMessage("Receipt settings saved successfully");
        setStoreInfo(updatedInfo);
        setTimeout(() => setMessage(""), 3000);
      } else {
        setError(result.error || "Failed to save receipt settings");
      }
    } catch (err) {
      setError("Error saving receipt settings");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setReceiptHeader("");
    setReceiptFooter("Thank you for your business!");
  };

  const getCurrentDateTime = () => {
    return new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="receipt-settings-loading">
        <p>Loading receipt settings...</p>
      </div>
    );
  }

  return (
    <div className="receipt-settings-container">
      <div className="receipt-settings-header">
        <h3>Receipt Settings</h3>
        <p className="settings-subtitle">Customize your receipt header and footer text</p>
      </div>

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="receipt-settings-content">
        <div className="settings-column">
          <div className="settings-section">
            <h4>Receipt Header</h4>
            <p className="field-description">
              This text appears at the top of every receipt, below your store information.
            </p>
            <textarea
              value={receiptHeader}
              onChange={(e) => setReceiptHeader(e.target.value)}
              placeholder="Enter custom header text (optional)&#10;Example: Welcome! Thank you for shopping with us!"
              rows={4}
              maxLength={200}
              disabled={saving}
              className="receipt-textarea"
            />
            <span className="char-count">{receiptHeader.length}/200 characters</span>
          </div>

          <div className="settings-section">
            <h4>Receipt Footer</h4>
            <p className="field-description">
              This text appears at the bottom of every receipt.
            </p>
            <textarea
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder="Enter custom footer text&#10;Example: Thank you! Please come again!"
              rows={4}
              maxLength={200}
              disabled={saving}
              className="receipt-textarea"
            />
            <span className="char-count">{receiptFooter.length}/200 characters</span>
          </div>

          <div className="predefined-messages">
            <h4>Quick Insert Templates</h4>
            <div className="template-buttons">
              <button 
                onClick={() => setReceiptHeader("Welcome to " + (storeInfo?.store_name || "Our Store") + "!")}
                className="template-btn"
              >
                Welcome Message
              </button>
              <button 
                onClick={() => setReceiptFooter("Thank you for your business!\nHave a great day!")}
                className="template-btn"
              >
                Thank You
              </button>
              <button 
                onClick={() => setReceiptFooter("Visit us again!\nFollow us on social media @store")}
                className="template-btn"
              >
                Social Media
              </button>
              <button 
                onClick={() => setReceiptFooter("Returns accepted within 30 days with receipt.\nThank you!")}
                className="template-btn"
              >
                Return Policy
              </button>
              <button 
                onClick={() => setReceiptFooter("Join our loyalty program!\nAsk cashier for details.")}
                className="template-btn"
              >
                Loyalty Program
              </button>
              <button 
                onClick={() => setReceiptHeader("HAPPY HOUR 3-6PM DAILY\n10% OFF ALL WINES")}
                className="template-btn"
              >
                Promotion
              </button>
            </div>
          </div>

          <div className="settings-actions">
            <button 
              onClick={handleSave}
              className="save-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button 
              onClick={resetToDefaults}
              className="reset-btn"
              disabled={saving}
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        <div className="preview-column">
          <div className="preview-header">
            <h4>Receipt Preview</h4>
            <div className="preview-mode-toggle">
              <button 
                className={`mode-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                onClick={() => setPreviewMode('desktop')}
              >
                Desktop
              </button>
              <button 
                className={`mode-btn ${previewMode === 'receipt' ? 'active' : ''}`}
                onClick={() => setPreviewMode('receipt')}
              >
                Receipt Paper
              </button>
            </div>
          </div>
          
          <div className={`receipt-preview ${previewMode}`}>
            <div className="receipt-content">
              {/* Store Info */}
              <div className="receipt-store-info">
                <h5>{storeInfo?.store_name || "Your Store Name"}</h5>
                <p>{storeInfo?.address_line1 || "123 Main Street"}</p>
                {storeInfo?.address_line2 && <p>{storeInfo.address_line2}</p>}
                <p>{storeInfo?.city || "City"}, {storeInfo?.state || "ST"} {storeInfo?.zip_code || "12345"}</p>
                <p>Tel: {storeInfo?.phone_number || "(555) 123-4567"}</p>
              </div>

              {/* Custom Header */}
              {receiptHeader && (
                <div className="receipt-custom-header">
                  {receiptHeader.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}

              <div className="receipt-divider">{'='.repeat(32)}</div>

              {/* Sample Transaction */}
              <div className="receipt-transaction">
                <p className="receipt-date">{getCurrentDateTime()}</p>
                <p className="receipt-trans">Transaction #: 000123</p>
                <p className="receipt-cashier">Cashier: John Doe</p>
              </div>

              <div className="receipt-divider">{'-'.repeat(32)}</div>

              {/* Sample Items */}
              <div className="receipt-items">
                <div className="receipt-item">
                  <span>Sample Wine 750ml</span>
                  <span>$24.99</span>
                </div>
                <div className="receipt-item">
                  <span>Premium Vodka 1L</span>
                  <span>$35.99</span>
                </div>
                <div className="receipt-item">
                  <span>Craft Beer 6-pack</span>
                  <span>$12.99</span>
                </div>
              </div>

              <div className="receipt-divider">{'-'.repeat(32)}</div>

              {/* Totals */}
              <div className="receipt-totals">
                <div className="receipt-total-line">
                  <span>Subtotal:</span>
                  <span>$73.97</span>
                </div>
                <div className="receipt-total-line">
                  <span>Tax ({storeInfo?.tax_rate || 6}%):</span>
                  <span>$4.44</span>
                </div>
                <div className="receipt-total-line receipt-grand-total">
                  <span>TOTAL:</span>
                  <span>$78.41</span>
                </div>
                <div className="receipt-total-line">
                  <span>Cash:</span>
                  <span>$80.00</span>
                </div>
                <div className="receipt-total-line">
                  <span>Change:</span>
                  <span>$1.59</span>
                </div>
              </div>

              <div className="receipt-divider">{'='.repeat(32)}</div>

              {/* Custom Footer */}
              {receiptFooter && (
                <div className="receipt-custom-footer">
                  {receiptFooter.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}

              {/* Barcode placeholder */}
              <div className="receipt-barcode">
                <div className="barcode-placeholder">||||| |||| | |||| |||||</div>
                <p className="barcode-number">*000123*</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}