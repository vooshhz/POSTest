import { api } from '../api/apiLayer';
import { useState, useEffect } from "react";
import "./ProductPerformance.css";

export default function ProductPerformance() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProductData();
  }, []);

  const fetchProductData = async () => {
    setLoading(true);
    try {
      // Fetch inventory and sales data
      const inventory = await api.getInventory();
      if (inventory.success && inventory.data) {
        setProducts(inventory.data.slice(0, 20));
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="report-loading">Loading product performance...</div>;
  }

  return (
    <div className="product-performance-container">
      <h3>Product Performance Report</h3>
      
      <div className="performance-grid">
        <div className="metric-card">
          <div className="metric-label">Top Performer</div>
          <div className="metric-value">{products?.[0]?.description || 'N/A'}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Total Products</div>
          <div className="metric-value">{products?.length || 0}</div>
        </div>
      </div>

      <div className="products-table">
        <h4>Product Rankings</h4>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={index}>
                <td>#{index + 1}</td>
                <td>{product.description}</td>
                <td>{product.quantity}</td>
                <td>${product.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}