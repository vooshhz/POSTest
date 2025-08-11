import React, { useState } from 'react';
import './StoreSetup.css';

interface StoreInfo {
  store_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  phone_number: string;
  tax_rate: number;
  receipt_header: string;
  receipt_footer: string;
}

interface StoreSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function StoreSetup({ onComplete, onCancel }: StoreSetupProps) {
  const [formData, setFormData] = useState<StoreInfo>({
    store_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'MI',
    zip_code: '',
    phone_number: '',
    tax_rate: 6.0,
    receipt_header: '',
    receipt_footer: 'Thank you for your business!'
  });

  const [errors, setErrors] = useState<Partial<StoreInfo>>({});
  const [saving, setSaving] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<StoreInfo> = {};

    if (!formData.store_name.trim()) {
      newErrors.store_name = 'Store name is required';
    }
    if (!formData.address_line1.trim()) {
      newErrors.address_line1 = 'Address is required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!formData.zip_code.trim()) {
      newErrors.zip_code = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.zip_code)) {
      newErrors.zip_code = 'Invalid ZIP code format';
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required';
    } else if (!/^[\d\s\-\(\)]+$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Invalid phone number format';
    }
    if (formData.tax_rate < 0 || formData.tax_rate > 100) {
      newErrors.tax_rate = 'Tax rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const result = await window.api.saveStoreInfo(formData);
      
      if (result.success) {
        onComplete();
      } else {
        alert('Failed to save store information: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save store info error:', error);
      alert('Failed to save store information');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof StoreInfo, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  return (
    <div className="store-setup-overlay">
      <div className="store-setup-container">
        <div className="store-setup-header">
          <h1>Store Setup</h1>
          <p>Welcome! Please set up your store information to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="store-setup-form">
          <div className="form-section">
            <h2>Basic Information</h2>
            
            <div className="form-group">
              <label htmlFor="store_name">
                Store Name <span className="required">*</span>
              </label>
              <input
                id="store_name"
                type="text"
                value={formData.store_name}
                onChange={(e) => handleChange('store_name', e.target.value)}
                className={errors.store_name ? 'error' : ''}
                placeholder="Enter your store name"
              />
              {errors.store_name && <span className="error-message">{errors.store_name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone_number">
                Phone Number <span className="required">*</span>
              </label>
              <input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleChange('phone_number', e.target.value)}
                className={errors.phone_number ? 'error' : ''}
                placeholder="(555) 123-4567"
              />
              {errors.phone_number && <span className="error-message">{errors.phone_number}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="tax_rate">
                Tax Rate (%) <span className="required">*</span>
              </label>
              <input
                id="tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.tax_rate}
                onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value) || 0)}
                className={errors.tax_rate ? 'error' : ''}
              />
              {errors.tax_rate && <span className="error-message">{errors.tax_rate}</span>}
            </div>
          </div>

          <div className="form-section">
            <h2>Address</h2>
            
            <div className="form-group">
              <label htmlFor="address_line1">
                Address Line 1 <span className="required">*</span>
              </label>
              <input
                id="address_line1"
                type="text"
                value={formData.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
                className={errors.address_line1 ? 'error' : ''}
                placeholder="123 Main Street"
              />
              {errors.address_line1 && <span className="error-message">{errors.address_line1}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="address_line2">
                Address Line 2
              </label>
              <input
                id="address_line2"
                type="text"
                value={formData.address_line2}
                onChange={(e) => handleChange('address_line2', e.target.value)}
                placeholder="Suite/Apt/Unit (optional)"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">
                  City <span className="required">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={errors.city ? 'error' : ''}
                  placeholder="City"
                />
                {errors.city && <span className="error-message">{errors.city}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="state">
                  State <span className="required">*</span>
                </label>
                <input
                  id="state"
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className={errors.state ? 'error' : ''}
                  maxLength={2}
                  placeholder="MI"
                />
                {errors.state && <span className="error-message">{errors.state}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="zip_code">
                  ZIP Code <span className="required">*</span>
                </label>
                <input
                  id="zip_code"
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => handleChange('zip_code', e.target.value)}
                  className={errors.zip_code ? 'error' : ''}
                  placeholder="12345"
                />
                {errors.zip_code && <span className="error-message">{errors.zip_code}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Receipt Settings</h2>
            
            <div className="form-group">
              <label htmlFor="receipt_header">
                Receipt Header Text
              </label>
              <textarea
                id="receipt_header"
                value={formData.receipt_header}
                onChange={(e) => handleChange('receipt_header', e.target.value)}
                placeholder="Optional text to appear at the top of receipts"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="receipt_footer">
                Receipt Footer Text
              </label>
              <textarea
                id="receipt_footer"
                value={formData.receipt_footer}
                onChange={(e) => handleChange('receipt_footer', e.target.value)}
                placeholder="Text to appear at the bottom of receipts"
                rows={3}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-btn"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}