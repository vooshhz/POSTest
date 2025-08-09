import React, { useState } from 'react';
import type { ProductData } from '../../global';

interface BarcodeScannerProps {
  onProductFound: (product: ProductData | null, searchedUPC: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onProductFound }) => {
  const [upcInput, setUpcInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearched, setLastSearched] = useState('');

  const handleSearch = async () => {
    if (!upcInput.trim()) return;

    const searchUPC = upcInput.trim();
    setIsSearching(true);
    setLastSearched(searchUPC);

    console.log('BarcodeScanner: Starting search for UPC:', searchUPC);

    try {
      const product = await window.api.searchProductByUPC(searchUPC);
      console.log('BarcodeScanner: Search result:', product);
      onProductFound(product, searchUPC);
    } catch (error) {
      console.error('BarcodeScanner: Error searching for product:', error);
      onProductFound(null, searchUPC);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    setUpcInput(value);
  };

  const handleClear = () => {
    setUpcInput('');
    setLastSearched('');
    onProductFound(null, '');
  };

  return (
    <div className="barcode-scanner">
      <div className="scanner-header">
        <h3>Barcode Scanner</h3>
        <p>Enter a UPC code to search for product information</p>
      </div>

      <div className="scanner-input-group">
        <div className="input-container">
          <input
            type="text"
            value={upcInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter UPC code (e.g., 012345678905)"
            className="scanner-input"
            maxLength={13}
            disabled={isSearching}
          />
          <button
            onClick={handleSearch}
            disabled={!upcInput.trim() || isSearching}
            className="btn btn-primary scanner-btn"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {(upcInput || lastSearched) && (
            <button
              onClick={handleClear}
              disabled={isSearching}
              className="btn btn-secondary scanner-btn"
            >
              Clear
            </button>
          )}
        </div>
        <small className="scanner-hint">
          Enter 8, 12, or 13 digit UPC/EAN code
        </small>
      </div>
    </div>
  );
};