import { useState, useEffect } from "react";
import "./StoreInfo.css";

interface StoreData {
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

export default function StoreInfo() {
  const [storeData, setStoreData] = useState<StoreData>({
    store_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    phone_number: "",
    tax_rate: 6.0,
    receipt_header: "",
    receipt_footer: "Thank you for your business!"
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    setLoading(true);
    try {
      const result = await window.api.getStoreInfo();
      if (result.success && result.data) {
        setStoreData(result.data);
      }
    } catch (err) {
      setError("Failed to load store information");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeData.store_name || !storeData.address_line1 || !storeData.city || 
        !storeData.state || !storeData.zip_code || !storeData.phone_number) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await window.api.saveStoreInfo(storeData);
      if (result.success) {
        setMessage("Store information updated successfully");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setError(result.error || "Failed to save store information");
      }
    } catch (err) {
      setError("Error saving store information");
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setStoreData({ ...storeData, phone_number: formatted });
  };

  if (loading) {
    return (
      <div className="store-info-loading">
        <p>Loading store information...</p>
      </div>
    );
  }

  return (
    <div className="store-info-container">
      <div className="store-info-header">
        <h3>Store Information</h3>
        <p className="store-info-subtitle">Configure your store details and receipt settings</p>
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

      <div className="store-info-form">
        <div className="form-section">
          <h4>Basic Information</h4>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Store Name *</label>
              <input
                type="text"
                value={storeData.store_name}
                onChange={(e) => setStoreData({ ...storeData, store_name: e.target.value })}
                placeholder="Enter store name"
                disabled={saving}
              />
            </div>

            <div className="form-group full-width">
              <label>Address Line 1 *</label>
              <input
                type="text"
                value={storeData.address_line1}
                onChange={(e) => setStoreData({ ...storeData, address_line1: e.target.value })}
                placeholder="Street address"
                disabled={saving}
              />
            </div>

            <div className="form-group full-width">
              <label>Address Line 2</label>
              <input
                type="text"
                value={storeData.address_line2 || ""}
                onChange={(e) => setStoreData({ ...storeData, address_line2: e.target.value })}
                placeholder="Apartment, suite, etc. (optional)"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={storeData.city}
                onChange={(e) => setStoreData({ ...storeData, city: e.target.value })}
                placeholder="City"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                value={storeData.state}
                onChange={(e) => setStoreData({ ...storeData, state: e.target.value })}
                placeholder="State"
                maxLength={2}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>ZIP Code *</label>
              <input
                type="text"
                value={storeData.zip_code}
                onChange={(e) => setStoreData({ ...storeData, zip_code: e.target.value })}
                placeholder="ZIP code"
                maxLength={10}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={storeData.phone_number}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label>Tax Rate (%) *</label>
              <input
                type="number"
                value={storeData.tax_rate}
                onChange={(e) => setStoreData({ ...storeData, tax_rate: parseFloat(e.target.value) || 0 })}
                placeholder="6.0"
                step="0.01"
                min="0"
                max="100"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>Receipt Settings</h4>
          <div className="form-group full-width">
            <label>Receipt Header</label>
            <textarea
              value={storeData.receipt_header || ""}
              onChange={(e) => setStoreData({ ...storeData, receipt_header: e.target.value })}
              placeholder="Text to appear at the top of receipts (optional)"
              rows={3}
              disabled={saving}
            />
          </div>

          <div className="form-group full-width">
            <label>Receipt Footer</label>
            <textarea
              value={storeData.receipt_footer || ""}
              onChange={(e) => setStoreData({ ...storeData, receipt_footer: e.target.value })}
              placeholder="Text to appear at the bottom of receipts"
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}