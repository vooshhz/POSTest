import React, { useEffect } from 'react';
import { DollarSign, CreditCard } from 'lucide-react';
import './TransactionDetails.css';

interface Transaction {
  id: number;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_type: string;
  cash_given: number | null;
  change_given: number | null;
  created_at: string;
}

interface ParsedItem {
  description: string;
  quantity: number;
  price: number;
  total: number;
}

export function TransactionDetails() {
  const [transaction, setTransaction] = React.useState<Transaction | null>(null);

  useEffect(() => {
    // Get transaction data from URL params
    const params = new URLSearchParams(window.location.search);
    const transactionData = params.get('transaction');
    
    if (transactionData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(transactionData));
        setTransaction(parsed);
      } catch (err) {
        console.error('Failed to parse transaction data:', err);
      }
    }
  }, []);

  const parseItems = (itemsString: string): ParsedItem[] => {
    try {
      return JSON.parse(itemsString);
    } catch {
      return [];
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <DollarSign className="w-5 h-5" />;
      case 'debit':
      case 'credit':
        return <CreditCard className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'cash':
        return 'payment-cash';
      case 'debit':
        return 'payment-debit';
      case 'credit':
        return 'payment-credit';
      default:
        return 'payment-default';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (!transaction) {
    return (
      <div className="transaction-details-loading">
        Loading transaction details...
      </div>
    );
  }

  return (
    <div className="transaction-details-container">
      <div className="transaction-details-header">
        <div className="header-info">
          <h1>Transaction #{transaction.id}</h1>
          <div className="header-date">
            <span>{formatDate(transaction.created_at)}</span>
            <span className="separator">•</span>
            <span>{formatTime(transaction.created_at)}</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handlePrint} className="print-btn">
            Print
          </button>
          <button onClick={handleClose} className="close-btn">
            Close
          </button>
        </div>
      </div>

      <div className="transaction-details-content">
        <div className="details-section">
          <h2>Items Purchased</h2>
          <div className="items-table">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {parseItems(transaction.items).map((item, index) => (
                  <tr key={index}>
                    <td className="item-description">{item.description || 'Unknown Item'}</td>
                    <td className="item-quantity">{item.quantity || 0}</td>
                    <td className="item-price">${(item.price || 0).toFixed(2)}</td>
                    <td className="item-total">${(item.total || (item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="details-section payment-summary">
          <h2>Payment Summary</h2>
          <div className="summary-grid">
            <div className="summary-row">
              <span className="summary-label">Subtotal:</span>
              <span className="summary-value">${(transaction.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Tax:</span>
              <span className="summary-value">${(transaction.tax || 0).toFixed(2)}</span>
            </div>
            <div className="summary-row total-row">
              <span className="summary-label">Total:</span>
              <span className="summary-value">${(transaction.total || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="payment-method">
            <h3>Payment Method</h3>
            <div className={`payment-badge ${getPaymentTypeColor(transaction.payment_type)}`}>
              {getPaymentTypeIcon(transaction.payment_type)}
              <span>{transaction.payment_type.charAt(0).toUpperCase() + transaction.payment_type.slice(1)}</span>
            </div>
            
            {transaction.payment_type === 'cash' && transaction.cash_given && (
              <div className="cash-details">
                <div className="cash-row">
                  <span>Cash Given:</span>
                  <span>${(transaction.cash_given || 0).toFixed(2)}</span>
                </div>
                <div className="cash-row">
                  <span>Change:</span>
                  <span>${(transaction.change_given || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}