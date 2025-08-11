import { useState, useEffect } from "react";
import "./InventoryTransactions.css";

interface InventoryTransaction {
  transaction_id: number;
  upc: string;
  description: string;
  category: string | null;
  volume: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  payment_type: string;
  transaction_total: number;
  created_at: string;
}

type SortField = 'transaction_id' | 'created_at' | 'upc' | 'description' | 'category' | 'quantity' | 'unit_price' | 'total';
type SortDirection = 'asc' | 'desc';

interface InventoryTransactionsProps {
  searchFilter: string;
}

export default function InventoryTransactions({ searchFilter }: InventoryTransactionsProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField>('transaction_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [totals, setTotals] = useState({
    totalTransactions: 0,
    totalItems: 0,
    totalValue: 0
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    setError("");
    
    try {
      const result = await window.api.getInventoryTransactions();
      
      if (result.success && result.data) {
        setTransactions(result.data);
        calculateTotals(result.data);
      } else {
        setError(result.error || "Failed to load inventory transactions");
      }
    } catch (err) {
      setError("Failed to load inventory transactions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (items: InventoryTransaction[]) => {
    const uniqueTransactions = new Set(items.map(item => item.transaction_id));
    const totals = items.reduce((acc, item) => ({
      totalTransactions: uniqueTransactions.size,
      totalItems: acc.totalItems + item.quantity,
      totalValue: acc.totalValue + item.total
    }), {
      totalTransactions: 0,
      totalItems: 0,
      totalValue: 0
    });
    
    totals.totalTransactions = uniqueTransactions.size;
    setTotals(totals);
  };

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'desc';
    
    if (sortField === field) {
      newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    }
    
    setSortField(field);
    setSortDirection(newDirection);
    
    const sortedData = [...transactions].sort((a, b) => {
      let aValue: any = a[field];
      let bValue: any = b[field];
      
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'desc' ? ' ↓' : ' ↑';
  };

  const getPaymentTypeBadge = (type: string) => {
    const className = `payment-badge payment-${type}`;
    return (
      <span className={className}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const openTransaction = async (transactionId: number) => {
    // Get the full transaction details
    const result = await window.api.getTransactions();
    if (result.success && result.data) {
      const transaction = result.data.find((t: any) => t.id === transactionId);
      if (transaction) {
        await window.api.openTransactionDetails(transaction);
      }
    }
  };

  // Filter transactions based on search
  const filteredTransactions = searchFilter 
    ? transactions.filter(item => 
        item.upc.includes(searchFilter) || 
        item.description.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : transactions;

  if (loading) {
    return <div className="inventory-loading">Loading inventory transactions...</div>;
  }

  return (
    <div className="inventory-transactions-container">
      {/* Summary Cards */}
      <div className="transaction-summary">
        <div className="summary-card">
          <span className="summary-label">Total Sales</span>
          <span className="summary-value">{totals.totalTransactions}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Items Sold</span>
          <span className="summary-value">{totals.totalItems}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Revenue</span>
          <span className="summary-value">{formatCurrency(totals.totalValue)}</span>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="transaction-actions">
        <button onClick={loadTransactions} className="refresh-btn">
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && <div className="inventory-error">Error: {error}</div>}
      
      {searchFilter && (
        <div className="filter-notice">
          Showing results for: {searchFilter}
        </div>
      )}
      
      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <div className="no-transactions">
          {searchFilter ? `No transactions found for: ${searchFilter}` : "No inventory transactions yet"}
        </div>
      ) : (
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('transaction_id')} className="sortable">
                  Trans #{getSortIndicator('transaction_id')}
                </th>
                <th onClick={() => handleSort('created_at')} className="sortable">
                  Date/Time{getSortIndicator('created_at')}
                </th>
                <th onClick={() => handleSort('upc')} className="sortable">
                  UPC{getSortIndicator('upc')}
                </th>
                <th onClick={() => handleSort('description')} className="sortable">
                  Description{getSortIndicator('description')}
                </th>
                <th onClick={() => handleSort('category')} className="sortable">
                  Category{getSortIndicator('category')}
                </th>
                <th>Volume</th>
                <th onClick={() => handleSort('quantity')} className="sortable">
                  Qty Sold{getSortIndicator('quantity')}
                </th>
                <th onClick={() => handleSort('unit_price')} className="sortable">
                  Unit Price{getSortIndicator('unit_price')}
                </th>
                <th onClick={() => handleSort('total')} className="sortable">
                  Line Total{getSortIndicator('total')}
                </th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => (
                <tr key={`${transaction.transaction_id}-${transaction.upc}-${index}`}>
                  <td className="trans-id-cell">#{transaction.transaction_id}</td>
                  <td className="date-cell">{formatDate(transaction.created_at)}</td>
                  <td className="upc-cell">{transaction.upc}</td>
                  <td className="description-cell">{transaction.description}</td>
                  <td>{transaction.category || "N/A"}</td>
                  <td>{transaction.volume ? `${transaction.volume} mL` : "N/A"}</td>
                  <td className="quantity-cell">{transaction.quantity}</td>
                  <td className="currency-cell">{formatCurrency(transaction.unit_price)}</td>
                  <td className="total-cell">{formatCurrency(transaction.total)}</td>
                  <td className="payment-cell">
                    {getPaymentTypeBadge(transaction.payment_type)}
                  </td>
                  <td>
                    <button 
                      onClick={() => openTransaction(transaction.transaction_id)}
                      className="view-trans-btn"
                      title="View full transaction"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}