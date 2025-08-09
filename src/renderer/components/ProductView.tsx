import React from 'react';
import type { ProductData } from '../../global';

interface ProductViewProps {
  product: ProductData | null;
  searchedUPC?: string;
}

export const ProductView: React.FC<ProductViewProps> = ({ product, searchedUPC }) => {
  console.log('ProductView render - searchedUPC:', searchedUPC, 'product:', product);
  
  if (!searchedUPC) {
    return (
      <div className="product-view-empty">
        <div className="empty-state">
          <h3>No Search Performed</h3>
          <p>Use the Barcode Scanner to search for a product</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-view-empty">
        <div className="empty-state error-state">
          <h3>No Product Found</h3>
          <p>UPC code "{searchedUPC}" was not found in the product database</p>
          <small>Please verify the UPC code and try again</small>
        </div>
      </div>
    );
  }

  return (
    <div className="product-view">
      <div className="product-header">
        <h3>Product Information</h3>
        <span className="product-upc">UPC: {product.upc}</span>
      </div>

      <div className="product-details">
        <div className="detail-section">
          <h4>Basic Information</h4>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Item Description:</label>
              <span className="detail-value primary">{product.itemDescription || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Category:</label>
              <span className="detail-value">{product.categoryName || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Item Number:</label>
              <span className="detail-value">{product.itemNumber || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Product Details</h4>
          <div className="detail-grid">
            <div className="detail-item">
              <label>Volume:</label>
              <span className="detail-value">{product.bottleVolumeML ? `${product.bottleVolumeML} ml` : 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Pack Size:</label>
              <span className="detail-value">{product.pack || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>Vendor:</label>
              <span className="detail-value">{product.vendorName || product.vendor || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Pricing</h4>
          <div className="detail-grid pricing-grid">
            <div className="detail-item">
              <label>State Bottle Cost:</label>
              <span className="detail-value price">{product.stateBottleCost ? `$${product.stateBottleCost}` : 'N/A'}</span>
            </div>
            <div className="detail-item">
              <label>State Bottle Retail:</label>
              <span className="detail-value price retail-price">{product.stateBottleRetail ? `$${product.stateBottleRetail}` : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="product-actions">
        <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(product.upc)}>
          Copy UPC
        </button>
        <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(product.itemDescription)}>
          Copy Description
        </button>
      </div>
    </div>
  );
};