import { useState, useEffect } from 'react';
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
  created_by_user_id?: number | null;
  created_by_username?: string | null;
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
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 20;
  
  // Date filter states
  const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'ytd' | 'all'>('today');
  
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
        setAllTransactions(result.data);
        applyFilters(result.data);
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

  const applyFilters = (data: Transaction[]) => {
    let filtered = [...data];
    const now = new Date();
    
    // Helper function to get local date from ISO string
    const getLocalDate = (isoString: string): string => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Get today's local date
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Apply date filter
    if (filterType === 'today') {
      filtered = filtered.filter(t => {
        const transDate = getLocalDate(t.created_at);
        return transDate === todayLocal;
      });
    } else if (filterType === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      filtered = filtered.filter(t => {
        const transDate = getLocalDate(t.created_at);
        return transDate === yesterdayStr;
      });
    } else if (filterType === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(t => {
        const transDate = new Date(t.created_at);
        return transDate >= weekAgo;
      });
    } else if (filterType === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(t => {
        const transDate = new Date(t.created_at);
        return transDate >= monthAgo;
      });
    } else if (filterType === 'ytd') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      filtered = filtered.filter(t => {
        const transDate = new Date(t.created_at);
        return transDate >= yearStart;
      });
    }
    // 'all' shows everything - no filter needed
    
    setTransactions(filtered);
    calculateTotals(filtered);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (allTransactions.length > 0) {
      applyFilters(allTransactions);
    }
  }, [filterType]);

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
    setCurrentPage(1); // Reset to first page when sorting changes
    
    const sortedData = [...allTransactions].sort((a, b) => {
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
    
    setAllTransactions(sortedData);
    applyFilters(sortedData);
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

  // Pagination calculations
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(transactions.length / transactionsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return pageNumbers;
  };

  if (loading) {
    return <div className="transaction-loading">Loading transactions...</div>;
  }

  return (
    <div className="transaction-container">
      <div className="transaction-header">
        <h2>Transaction History</h2>
      </div>

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

      {/* Date Filter Controls */}
      <div className="transaction-filters">
        <div className="filter-section">
          <div className="filter-type-buttons">
            <button 
              className={`filter-type-btn ${filterType === 'today' ? 'active' : ''}`}
              onClick={() => setFilterType('today')}
            >
              Today
            </button>
            <button 
              className={`filter-type-btn ${filterType === 'yesterday' ? 'active' : ''}`}
              onClick={() => setFilterType('yesterday')}
            >
              Yesterday
            </button>
            <button 
              className={`filter-type-btn ${filterType === 'week' ? 'active' : ''}`}
              onClick={() => setFilterType('week')}
            >
              Last Week
            </button>
            <button 
              className={`filter-type-btn ${filterType === 'month' ? 'active' : ''}`}
              onClick={() => setFilterType('month')}
            >
              Last Month
            </button>
            <button 
              className={`filter-type-btn ${filterType === 'ytd' ? 'active' : ''}`}
              onClick={() => setFilterType('ytd')}
            >
              YTD
            </button>
            <button 
              className={`filter-type-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="transaction-actions">
          <button onClick={loadTransactions} className="refresh-btn">
            Refresh
          </button>
        </div>
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
                <th>User</th>
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
              {currentTransactions.map((transaction) => {
                const items = parseItems(transaction.items);
                const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
                
                return (
                  <tr key={transaction.id}>
                    <td className="id-cell">#{transaction.id}</td>
                    <td className="date-cell">
                      <div className="date-time">
                        <span className="date" style={{ color: '#333' }}>{formatDate(transaction.created_at)}</span>
                        <span className="time" style={{ color: '#666' }}>{formatTime(transaction.created_at)}</span>
                      </div>
                    </td>
                    <td className="user-cell">{transaction.created_by_username || 'system'}</td>
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {indexOfFirstTransaction + 1} - {Math.min(indexOfLastTransaction, transactions.length)} of {transactions.length} transactions
              </div>
              
              <div className="pagination-buttons">
                <button 
                  onClick={() => handlePageChange(1)} 
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  First
                </button>
                
                <button 
                  onClick={handlePreviousPage} 
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                
                {currentPage > 3 && totalPages > 5 && (
                  <span className="pagination-ellipsis">...</span>
                )}
                
                {getPageNumbers().map(number => (
                  <button
                    key={number}
                    onClick={() => handlePageChange(number)}
                    className={`pagination-btn ${currentPage === number ? 'active' : ''}`}
                  >
                    {number}
                  </button>
                ))}
                
                {currentPage < totalPages - 2 && totalPages > 5 && (
                  <span className="pagination-ellipsis">...</span>
                )}
                
                <button 
                  onClick={handleNextPage} 
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
                
                <button 
                  onClick={() => handlePageChange(totalPages)} 
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}