import React, { useState, useEffect } from 'react';
import './TransactionHistory.css';

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

type SortField = 'id' | 'created_at' | 'item_count' | 'payment_type' | 'subtotal' | 'tax' | 'total';
type SortDirection = 'asc' | 'desc';

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [totals, setTotals] = useState({
    totalTransactions: 0,
    totalItems: 0,
    totalRevenue: 0,
    totalTax: 0
  });

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.getTransactions();
      if (result.success && result.data) {
        setTransactions(result.data);
        calculateTotals(result.data);
      } else {
        setError(result.error || 'Failed to load transactions');
      }
    } catch (err) {
      setError('Error loading transactions');
      console.error('Load transactions error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const calculateTotals = (data: Transaction[]) => {
    const totals = data.reduce((acc, transaction) => {
      const items = parseItems(transaction.items);
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        totalTransactions: acc.totalTransactions + 1,
        totalItems: acc.totalItems + itemCount,
        totalRevenue: acc.totalRevenue + transaction.total,
        totalTax: acc.totalTax + transaction.tax
      };
    }, {
      totalTransactions: 0,
      totalItems: 0,
      totalRevenue: 0,
      totalTax: 0
    });
    
    setTotals(totals);
  };

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
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'desc';
    
    if (sortField === field) {
      newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    }
    
    setSortField(field);
    setSortDirection(newDirection);
    
    const sortedData = [...transactions].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch(field) {
        case 'item_count':
          const aItems = parseItems(a.items);
          const bItems = parseItems(b.items);
          aValue = aItems.reduce((sum, item) => sum + item.quantity, 0);
          bValue = bItems.reduce((sum, item) => sum + item.quantity, 0);
          break;
        default:
          aValue = a[field as keyof Transaction];
          bValue = b[field as keyof Transaction];
      }
      
      if (aValue === null) aValue = '';
      if (bValue === null) bValue = '';
      
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      
      if (newDirection === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });
    
    setTransactions(sortedData);
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'desc' ? ' ↓' : ' ↑';
  };

  const getPaymentTypeBadge = (type: string) => {
    const className = `payment-type-badge payment-type-${type}`;
    return (
      <span className={className}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const openTransactionDetails = async (transaction: Transaction) => {
    // Use IPC to open transaction details in a new window
    await window.api.openTransactionDetails(transaction);
  };

  if (loading) {
    return <div className="transaction-loading">Loading transactions...</div>;
  }

  return (
    <div className="transaction-container">
      <h2>Transaction History</h2>

      {/* Transaction Summary */}
      <div className="transaction-summary">
        <div className="summary-card">
          <span className="summary-label">Total Transactions</span>
          <span className="summary-value">{totals.totalTransactions}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Items Sold</span>
          <span className="summary-value">{totals.totalItems}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">{formatCurrency(totals.totalRevenue)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Tax</span>
          <span className="summary-value">{formatCurrency(totals.totalTax)}</span>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="transaction-actions">
        <button onClick={loadTransactions} className="refresh-btn">
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && <div className="transaction-error">Error: {error}</div>}

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <div className="no-transactions">
          No transactions yet. Transactions will appear here once you complete a sale.
        </div>
      ) : (
        <div className="transaction-table-wrapper">
          <table className="transaction-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} className="sortable">
                  ID{getSortIndicator('id')}
                </th>
                <th onClick={() => handleSort('created_at')} className="sortable">
                  Date & Time{getSortIndicator('created_at')}
                </th>
                <th onClick={() => handleSort('item_count')} className="sortable">
                  Items{getSortIndicator('item_count')}
                </th>
                <th onClick={() => handleSort('payment_type')} className="sortable">
                  Payment{getSortIndicator('payment_type')}
                </th>
                <th onClick={() => handleSort('subtotal')} className="sortable">
                  Subtotal{getSortIndicator('subtotal')}
                </th>
                <th onClick={() => handleSort('tax')} className="sortable">
                  Tax{getSortIndicator('tax')}
                </th>
                <th onClick={() => handleSort('total')} className="sortable">
                  Total{getSortIndicator('total')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const items = parseItems(transaction.items);
                const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
                
                return (
                  <tr key={transaction.id}>
                    <td className="id-cell">#{transaction.id}</td>
                    <td className="date-cell">
                      <div className="date-time">
                        <span className="date">{formatDate(transaction.created_at)}</span>
                        <span className="time">{formatTime(transaction.created_at)}</span>
                      </div>
                    </td>
                    <td className="items-cell">{itemCount}</td>
                    <td className="payment-cell">
                      {getPaymentTypeBadge(transaction.payment_type)}
                    </td>
                    <td className="currency-cell">{formatCurrency(transaction.subtotal)}</td>
                    <td className="currency-cell">{formatCurrency(transaction.tax)}</td>
                    <td className="total-cell">{formatCurrency(transaction.total)}</td>
                    <td>
                      <button 
                        onClick={() => openTransactionDetails(transaction)}
                        className="view-btn"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}