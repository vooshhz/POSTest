import { useState, useEffect } from "react";
import "./TillDashboard.css";

interface TillStatus {
  date: string;
  startingCash: number;
  currentCash: number;
  transactions: number;
  cashIn: number;
  cashOut: number;
  denominations: {
    ones: number;
    fives: number;
    tens: number;
    twenties: number;
    fifties: number;
    hundreds: number;
  };
}

export default function TillDashboard() {
  const [tillStatus, setTillStatus] = useState<TillStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTillStatus();
    // Refresh till status every 30 seconds
    const interval = setInterval(loadTillStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTillStatus = async () => {
    try {
      const result = await window.api.getCurrentTill();
      if (result.success && result.data) {
        setTillStatus(result.data);
      } else {
        setTillStatus(null);
      }
    } catch (err) {
      console.error("Error loading till status:", err);
    }
  };

  const handleCloseTill = async () => {
    if (!window.confirm("Are you sure you want to close today's till? This will finalize the count for today.")) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.closeTill();
      if (result.success) {
        setMessage("Till closed successfully!");
        setTillStatus(null);
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(result.error || "Failed to close till");
      }
    } catch (err) {
      setMessage("Error closing till");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetTill = async () => {
    if (!window.confirm("Are you sure you want to reset today's till? This will clear all transactions and start fresh. This action is intended for testing only!")) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.resetTill();
      if (result.success) {
        setMessage(result.message || "Till reset successfully!");
        if (result.data) {
          setTillStatus(result.data);
        } else {
          setTillStatus(null);
        }
        setTimeout(() => setMessage(""), 3000);
        // Reload till status
        await loadTillStatus();
      } else {
        setMessage(result.error || "Failed to reset till");
      }
    } catch (err) {
      setMessage("Error resetting till");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!tillStatus) {
    return (
      <div className="till-dashboard compact">
        <div className="till-status-badge inactive">
          <span className="status-icon">💰</span>
          <span>Till Not Active</span>
        </div>
      </div>
    );
  }

  const netChange = tillStatus.currentCash - tillStatus.startingCash;
  const isPositive = netChange >= 0;

  return (
    <div className="till-dashboard">
      {message && (
        <div className="till-message">{message}</div>
      )}
      
      <div className="till-summary">
        <div className="till-status-badge active">
          <span className="status-icon">💰</span>
          <span>Till Active</span>
        </div>
        
        <div className="till-quick-stats">
          <div className="stat-item">
            <span className="stat-label">Cash:</span>
            <span className="stat-value">${Math.round(tillStatus.currentCash)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">In:</span>
            <span className="stat-value cash-in">+${Math.round(tillStatus.cashIn)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Out:</span>
            <span className="stat-value cash-out">-${Math.round(tillStatus.cashOut)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Net:</span>
            <span className={`stat-value ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '+' : ''}{Math.round(netChange)}
            </span>
          </div>
        </div>

        <div className="till-actions-compact">
          <button
            className="till-toggle-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▼' : '▶'} Details
          </button>
          <button
            className="till-reset-btn"
            onClick={handleResetTill}
            disabled={loading}
            title="Reset till for testing"
          >
            Reset
          </button>
          <button
            className="till-close-btn"
            onClick={handleCloseTill}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="till-details">
          <div className="till-detail-row">
            <span>Starting Cash:</span>
            <span>${Math.round(tillStatus.startingCash)}</span>
          </div>
          <div className="till-detail-row">
            <span>Transactions:</span>
            <span>{tillStatus.transactions}</span>
          </div>
          
          <div className="till-denominations">
            <h5>Current Bills</h5>
            <div className="denomination-grid">
              <div className="denom">
                <span className="denom-label">$1:</span>
                <span className="denom-count">{tillStatus.denominations.ones}</span>
              </div>
              <div className="denom">
                <span className="denom-label">$5:</span>
                <span className="denom-count">{tillStatus.denominations.fives}</span>
              </div>
              <div className="denom">
                <span className="denom-label">$10:</span>
                <span className="denom-count">{tillStatus.denominations.tens}</span>
              </div>
              <div className="denom">
                <span className="denom-label">$20:</span>
                <span className="denom-count">{tillStatus.denominations.twenties}</span>
              </div>
              <div className="denom">
                <span className="denom-label">$50:</span>
                <span className="denom-count">{tillStatus.denominations.fifties}</span>
              </div>
              <div className="denom">
                <span className="denom-label">$100:</span>
                <span className="denom-count">{tillStatus.denominations.hundreds}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}