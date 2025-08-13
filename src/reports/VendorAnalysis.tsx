import { useState, useEffect } from "react";
import "./VendorAnalysis.css";

export default function VendorAnalysis() {
  const [vendors] = useState([
    { name: "Premium Spirits Co.", products: 45, value: 15420, margin: 35 },
    { name: "Wine Direct", products: 32, value: 8960, margin: 28 },
    { name: "Local Brewery", products: 28, value: 6230, margin: 42 },
    { name: "Import House", products: 18, value: 4850, margin: 25 },
    { name: "Craft Distillers", products: 12, value: 3200, margin: 38 }
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const totalValue = vendors.reduce((sum, v) => sum + v.value, 0);

  return (
    <div className="vendor-analysis-container">
      <h3>Vendor Analysis</h3>

      <div className="vendor-metrics">
        <div className="metric-card">
          <div className="metric-label">Total Vendors</div>
          <div className="metric-value">{vendors.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Inventory Value</div>
          <div className="metric-value">{formatCurrency(totalValue)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Margin</div>
          <div className="metric-value">
            {(vendors.reduce((sum, v) => sum + v.margin, 0) / vendors.length).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="vendors-table">
        <h4>Top Vendors</h4>
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Products</th>
              <th>Inventory Value</th>
              <th>Margin %</th>
              <th>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor, index) => (
              <tr key={index}>
                <td>
                  <div className="vendor-name">
                    <span className="vendor-rank">#{index + 1}</span>
                    {vendor.name}
                  </div>
                </td>
                <td>{vendor.products}</td>
                <td className="value-cell">{formatCurrency(vendor.value)}</td>
                <td className="margin-cell">{vendor.margin}%</td>
                <td>
                  <div className="percentage-bar">
                    <div 
                      className="percentage-fill"
                      style={{ width: `${(vendor.value / totalValue) * 100}%` }}
                    />
                    <span className="percentage-text">
                      {((vendor.value / totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}