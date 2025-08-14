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

interface AdminUser {
  username: string;
  password: string;
  confirmPassword: string;
  fullName: string;
}

interface StoreSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function StoreSetup({ onComplete, onCancel }: StoreSetupProps) {
  const [currentStep, setCurrentStep] = useState<'store' | 'admin'>('store');
  const [formData, setFormData] = useState<StoreInfo>({
    store_name: 'Deerings Market',
    address_line1: '1142 Barlow St',
    address_line2: '',
    city: 'Traverse City',
    state: 'MI',
    zip_code: '12345',
    phone_number: '(231) 555-0100',
    tax_rate: 6.0,
    receipt_header: 'Deerings Market',
    receipt_footer: 'Thank you for your business!'
  });

  const [adminData, setAdminData] = useState<AdminUser>({
    username: 'admin',
    password: '',
    confirmPassword: '',
    fullName: 'Store Administrator'
  });
  
  const [errors, setErrors] = useState<Partial<StoreInfo> & Partial<AdminUser>>({});
  const [saving, setSaving] = useState(false);

  const validateStoreForm = (): boolean => {
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

  const validateAdminForm = (): boolean => {
    const newErrors: Partial<AdminUser> = {};

    if (!adminData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (adminData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!adminData.password) {
      newErrors.password = 'Password is required';
    } else if (adminData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }
    
    if (adminData.password !== adminData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!adminData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStoreForm()) {
      return;
    }

    setCurrentStep('admin');
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAdminForm()) {
      return;
    }

    setSaving(true);
    try {
      // First save store info
      const storeResult = await window.api.saveStoreInfo(formData);
      
      if (!storeResult.success) {
        alert('Failed to save store information: ' + (storeResult.error || 'Unknown error'));
        setSaving(false);
        return;
      }

      // Then create admin user - directly without checking current user
      // Since this is initial setup, there should be no current user
      const userResult = await window.api.addUserDuringSetup({
        username: adminData.username,
        password: adminData.password,
        role: 'admin',
        fullName: adminData.fullName
      });

      if (!userResult.success) {
        alert('Failed to create admin user: ' + (userResult.error || 'Unknown error'));
        setSaving(false);
        return;
      }

      // Auto-login the admin user
      const loginResult = await window.api.userLogin(adminData.username, adminData.password);
      if (loginResult.success) {
        onComplete();
      } else {
        // Still complete setup even if auto-login fails
        onComplete();
      }
    } catch (error) {
      console.error('Setup error:', error);
      alert('Failed to complete setup');
      setSaving(false);
    }
  };

  const handleStoreChange = (field: keyof StoreInfo, value: string | number) => {
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

  const handleAdminChange = (field: keyof AdminUser, value: string) => {
    setAdminData(prev => ({
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
          <h1>{currentStep === 'store' ? 'Store Setup' : 'Administrator Account'}</h1>
          <p>
            {currentStep === 'store' 
              ? 'Welcome! Please set up your store information to get started.'
              : 'Create your administrator account to manage the system.'}
          </p>
          <div className="setup-steps">
            <div className={`step ${currentStep === 'store' ? 'active' : 'completed'}`}>
              <span className="step-number">1</span>
              <span className="step-label">Store Info</span>
            </div>
            <div className="step-line"></div>
            <div className={`step ${currentStep === 'admin' ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Admin Account</span>
            </div>
          </div>
        </div>

        {currentStep === 'store' ? (
        <form onSubmit={handleStoreSubmit} className="store-setup-form">
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
                onChange={(e) => handleStoreChange('store_name', e.target.value)}
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
                onChange={(e) => handleStoreChange('phone_number', e.target.value)}
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
                onChange={(e) => handleStoreChange('tax_rate', parseFloat(e.target.value) || 0)}
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
                onChange={(e) => handleStoreChange('address_line1', e.target.value)}
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
                onChange={(e) => handleStoreChange('address_line2', e.target.value)}
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
                  onChange={(e) => handleStoreChange('city', e.target.value)}
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
                  onChange={(e) => handleStoreChange('state', e.target.value)}
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
                  onChange={(e) => handleStoreChange('zip_code', e.target.value)}
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
                onChange={(e) => handleStoreChange('receipt_header', e.target.value)}
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
                onChange={(e) => handleStoreChange('receipt_footer', e.target.value)}
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
              Continue to Admin Setup
            </button>
          </div>
        </form>
        ) : (
        <form onSubmit={handleFinalSubmit} className="store-setup-form">
          <div className="form-section">
            <h2>Administrator Account</h2>
            <p className="section-description">
              This account will have full access to manage users, inventory, and all system settings.
            </p>
            
            <div className="form-group">
              <label htmlFor="username">
                Username <span className="required">*</span>
              </label>
              <input
                id="username"
                type="text"
                value={adminData.username}
                onChange={(e) => handleAdminChange('username', e.target.value)}
                className={errors.username ? 'error' : ''}
                placeholder="Enter admin username"
                disabled={saving}
              />
              {errors.username && <span className="error-message">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fullName">
                Full Name <span className="required">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={adminData.fullName}
                onChange={(e) => handleAdminChange('fullName', e.target.value)}
                className={errors.fullName ? 'error' : ''}
                placeholder="Enter your full name"
                disabled={saving}
              />
              {errors.fullName && <span className="error-message">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={adminData.password}
                onChange={(e) => handleAdminChange('password', e.target.value)}
                className={errors.password ? 'error' : ''}
                placeholder="Enter a secure password"
                disabled={saving}
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={adminData.confirmPassword}
                onChange={(e) => handleAdminChange('confirmPassword', e.target.value)}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Re-enter password"
                disabled={saving}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>

            <div className="info-box">
              <strong>Important:</strong> Please save these credentials in a secure location. 
              You will need them to log in and manage the system.
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => setCurrentStep('store')}
              className="cancel-btn"
              disabled={saving}
            >
              Back
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={saving}
            >
              {saving ? 'Setting up...' : 'Complete Setup'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}