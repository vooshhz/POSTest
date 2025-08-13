import { useState, useEffect } from "react";
import "./ComplianceAudit.css";

export default function ComplianceAudit() {
  const [auditItems] = useState([
    { category: "Age Verification", status: "compliant", checks: 245, failures: 0 },
    { category: "Sales Hours", status: "compliant", checks: 30, failures: 0 },
    { category: "Tax Collection", status: "compliant", checks: 1052, failures: 0 },
    { category: "Inventory Tracking", status: "warning", checks: 820, failures: 3 },
    { category: "Price Accuracy", status: "compliant", checks: 650, failures: 0 }
  ]);

  const [recentActivity] = useState([
    { time: "10:45 AM", action: "Age verified", user: "Cashier 1", status: "success" },
    { time: "11:22 AM", action: "Inventory adjustment", user: "Manager", status: "warning" },
    { time: "12:15 PM", action: "Price override", user: "Cashier 2", status: "info" },
    { time: "02:30 PM", action: "Tax exemption applied", user: "Manager", status: "warning" },
    { time: "03:45 PM", action: "Refund processed", user: "Cashier 1", status: "info" }
  ]);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'compliant': return '✓';
      case 'warning': return '!';
      case 'error': return '✗';
      default: return '•';
    }
  };

  const getStatusClass = (status: string) => {
    return `status-badge ${status}`;
  };

  return (
    <div className="compliance-audit-container">
      <h3>Compliance & Audit Report</h3>

      <div className="compliance-overview">
        <div className="overview-card compliant">
          <div className="overview-icon">✓</div>
          <div className="overview-content">
            <div className="overview-label">Overall Status</div>
            <div className="overview-value">Compliant</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="overview-content">
            <div className="overview-label">Last Audit</div>
            <div className="overview-value">Today, 4:00 PM</div>
          </div>
        </div>
        
        <div className="overview-card">
          <div className="overview-content">
            <div className="overview-label">Total Checks</div>
            <div className="overview-value">2,797</div>
          </div>
        </div>
      </div>

      <div className="audit-categories">
        <h4>Compliance Categories</h4>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Status</th>
              <th>Checks</th>
              <th>Failures</th>
              <th>Compliance Rate</th>
            </tr>
          </thead>
          <tbody>
            {auditItems.map((item, index) => (
              <tr key={index}>
                <td>{item.category}</td>
                <td>
                  <span className={getStatusClass(item.status)}>
                    {getStatusIcon(item.status)} {item.status}
                  </span>
                </td>
                <td>{item.checks}</td>
                <td className={item.failures > 0 ? 'failures' : ''}>{item.failures}</td>
                <td>
                  <div className="compliance-rate">
                    {((1 - item.failures / item.checks) * 100).toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="recent-activity">
        <h4>Recent Audit Activity</h4>
        <div className="activity-list">
          {recentActivity.map((activity, index) => (
            <div key={index} className={`activity-item ${activity.status}`}>
              <span className="activity-time">{activity.time}</span>
              <span className="activity-action">{activity.action}</span>
              <span className="activity-user">{activity.user}</span>
              <span className={`activity-status ${activity.status}`}>
                {activity.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}