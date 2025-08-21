import React, { useState, useEffect } from 'react';
import DateRangePicker from '../components/DateRangePicker';
import api from '../api/apiLayer';
import '../Reports.css';

interface PnLData {
  startDate: string;
  endDate: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: {
    labor: number;
    rent: number;
    utilities: number;
    other: number;
    total: number;
  };
  netIncome: number;
  netMargin: number;
  transactions: number;
  unitsSold: number;
  averageTransactionValue: number;
}

interface CategoryPerformance {
  category: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  unitsSold: number;
  transactions: number;
}

interface ProductPerformance {
  upc: string;
  description: string;
  category: string;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  unitsSold: number;
  averageSellingPrice: number;
  inventoryTurnover: number;
}

interface Comparison {
  revenueChange: { amount: number; percentage: number };
  grossProfitChange: { amount: number; percentage: number };
  netIncomeChange: { amount: number; percentage: number };
  marginChange: { gross: number; net: number };
}

export default function ProfitAndLoss() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date()
  });
  const [pnlData, setPnLData] = useState<PnLData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryPerformance[]>([]);
  const [productData, setProductData] = useState<ProductPerformance[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'products' | 'expenses'>('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenses, setExpenses] = useState<{
    id?: number;
    category: string;
    subcategory?: string;
    amount: number;
    description: string;
    expense_date: string;
    recurring: boolean;
    created_at?: string;
    created_by?: string;
  }[]>([]);

  useEffect(() => {
    fetchPnLData();
  }, [dateRange]);

  const fetchPnLData = async () => {
    setLoading(true);
    try {
      const startStr = dateRange.start.toISOString().split('T')[0];
      const endStr = dateRange.end.toISOString().split('T')[0];

      // Get P&L data
      const pnlResult = await api.getPnL(startStr, endStr);
      if (pnlResult.success) {
        setPnLData(pnlResult.data);
      }

      // Get category performance
      const categoryResult = await api.getCategoryPerformance(startStr, endStr);
      if (categoryResult.success) {
        setCategoryData(categoryResult.data);
      }

      // Get product performance
      const productResult = await api.getProductPerformance(startStr, endStr, 20);
      if (productResult.success) {
        setProductData(productResult.data);
      }

      // Get expenses
      const expenseResult = await api.getOperatingExpenses(startStr, endStr);
      if (expenseResult.success) {
        setExpenses(expenseResult.data);
      }

      // Get comparison with previous period
      const periodLength = Math.floor((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
      const previousStart = new Date(dateRange.start);
      previousStart.setDate(previousStart.getDate() - periodLength - 1);
      const previousEnd = new Date(dateRange.start);
      previousEnd.setDate(previousEnd.getDate() - 1);

      const comparisonResult = await api.comparePnLPeriods(
        { start: startStr, end: endStr },
        { start: previousStart.toISOString().split('T')[0], end: previousEnd.toISOString().split('T')[0] }
      );

      if (comparisonResult.success) {
        setComparison(comparisonResult.data.comparison);
      }
    } catch (error) {
      console.error('Error fetching P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatChange = (change: { amount: number; percentage: number }) => {
    const sign = change.amount >= 0 ? '+' : '';
    const className = change.amount >= 0 ? 'positive-change' : 'negative-change';
    return (
      <span className={className}>
        {sign}{formatCurrency(change.amount)} ({sign}{formatPercentage(change.percentage)})
      </span>
    );
  };

  const handleAddExpense = async (expense: {
    category: string;
    amount: number;
    description: string;
    recurring: boolean;
  }) => {
    const result = await api.addOperatingExpense({
      ...expense,
      date: new Date().toISOString().split('T')[0],
      created_by: 'user'
    });

    if (result.success) {
      setShowExpenseModal(false);
      fetchPnLData();
    }
  };

  if (loading) {
    return <div className="loading">Loading P&L data...</div>;
  }

  return (
    <div className="pnl-report">
      <div className="report-header">
        <h2>Profit & Loss Statement</h2>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onStartDateChange={(date) => setDateRange({ ...dateRange, start: date })}
          onEndDateChange={(date) => setDateRange({ ...dateRange, end: date })}
        />
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'categories' ? 'active' : ''}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button
          className={activeTab === 'expenses' ? 'active' : ''}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
      </div>

      {activeTab === 'overview' && pnlData && (
        <div className="pnl-overview">
          <div className="metrics-grid">
            <div className="metric-card primary">
              <h3>Revenue</h3>
              <div className="metric-value">{formatCurrency(pnlData.revenue)}</div>
              {comparison && (
                <div className="metric-change">
                  {formatChange(comparison.revenueChange)}
                </div>
              )}
              <div className="metric-details">
                {pnlData.transactions} transactions • {formatCurrency(pnlData.averageTransactionValue)} avg
              </div>
            </div>

            <div className="metric-card">
              <h3>Cost of Goods Sold</h3>
              <div className="metric-value">{formatCurrency(pnlData.costOfGoodsSold)}</div>
              <div className="metric-details">
                {pnlData.unitsSold} units sold
              </div>
            </div>

            <div className="metric-card success">
              <h3>Gross Profit</h3>
              <div className="metric-value">{formatCurrency(pnlData.grossProfit)}</div>
              {comparison && (
                <div className="metric-change">
                  {formatChange(comparison.grossProfitChange)}
                </div>
              )}
              <div className="metric-details">
                {formatPercentage(pnlData.grossMargin)} margin
                {comparison && (
                  <span className={comparison.marginChange.gross >= 0 ? 'positive-change' : 'negative-change'}>
                    {' '}({comparison.marginChange.gross >= 0 ? '+' : ''}{comparison.marginChange.gross.toFixed(2)}pp)
                  </span>
                )}
              </div>
            </div>

            <div className="metric-card">
              <h3>Operating Expenses</h3>
              <div className="metric-value">{formatCurrency(pnlData.operatingExpenses.total)}</div>
              <div className="metric-details">
                <div>Labor: {formatCurrency(pnlData.operatingExpenses.labor)}</div>
                <div>Rent: {formatCurrency(pnlData.operatingExpenses.rent)}</div>
                <div>Utilities: {formatCurrency(pnlData.operatingExpenses.utilities)}</div>
                <div>Other: {formatCurrency(pnlData.operatingExpenses.other)}</div>
              </div>
            </div>

            <div className="metric-card highlight">
              <h3>Net Income</h3>
              <div className="metric-value">{formatCurrency(pnlData.netIncome)}</div>
              {comparison && (
                <div className="metric-change">
                  {formatChange(comparison.netIncomeChange)}
                </div>
              )}
              <div className="metric-details">
                {formatPercentage(pnlData.netMargin)} margin
                {comparison && (
                  <span className={comparison.marginChange.net >= 0 ? 'positive-change' : 'negative-change'}>
                    {' '}({comparison.marginChange.net >= 0 ? '+' : ''}{comparison.marginChange.net.toFixed(2)}pp)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pnl-statement">
            <h3>Income Statement</h3>
            <table className="statement-table">
              <tbody>
                <tr className="revenue-row">
                  <td>Revenue</td>
                  <td className="amount">{formatCurrency(pnlData.revenue)}</td>
                  <td className="percentage">100.00%</td>
                </tr>
                <tr>
                  <td>Cost of Goods Sold</td>
                  <td className="amount">({formatCurrency(pnlData.costOfGoodsSold)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.costOfGoodsSold / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr className="subtotal-row">
                  <td><strong>Gross Profit</strong></td>
                  <td className="amount"><strong>{formatCurrency(pnlData.grossProfit)}</strong></td>
                  <td className="percentage"><strong>{formatPercentage(pnlData.grossMargin)}</strong></td>
                </tr>
                <tr className="section-header">
                  <td colSpan={3}>Operating Expenses</td>
                </tr>
                <tr>
                  <td className="indent">Labor</td>
                  <td className="amount">({formatCurrency(pnlData.operatingExpenses.labor)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.operatingExpenses.labor / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr>
                  <td className="indent">Rent</td>
                  <td className="amount">({formatCurrency(pnlData.operatingExpenses.rent)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.operatingExpenses.rent / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr>
                  <td className="indent">Utilities</td>
                  <td className="amount">({formatCurrency(pnlData.operatingExpenses.utilities)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.operatingExpenses.utilities / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr>
                  <td className="indent">Other</td>
                  <td className="amount">({formatCurrency(pnlData.operatingExpenses.other)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.operatingExpenses.other / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr className="subtotal-row">
                  <td>Total Operating Expenses</td>
                  <td className="amount">({formatCurrency(pnlData.operatingExpenses.total)})</td>
                  <td className="percentage">
                    {pnlData.revenue > 0 ? formatPercentage((pnlData.operatingExpenses.total / pnlData.revenue) * 100) : '0.00%'}
                  </td>
                </tr>
                <tr className="total-row">
                  <td><strong>Net Income</strong></td>
                  <td className="amount"><strong>{formatCurrency(pnlData.netIncome)}</strong></td>
                  <td className="percentage"><strong>{formatPercentage(pnlData.netMargin)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="category-performance">
          <h3>Category Performance</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Gross Profit</th>
                <th>Margin</th>
                <th>Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((category, index) => (
                <tr key={index}>
                  <td>{category.category}</td>
                  <td>{formatCurrency(category.revenue)}</td>
                  <td>{formatCurrency(category.costOfGoodsSold)}</td>
                  <td>{formatCurrency(category.grossProfit)}</td>
                  <td>{formatPercentage(category.grossMargin)}</td>
                  <td>{category.unitsSold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="product-performance">
          <h3>Top Products by Revenue</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Gross Profit</th>
                <th>Margin</th>
                <th>Units</th>
                <th>Avg Price</th>
              </tr>
            </thead>
            <tbody>
              {productData.map((product, index) => (
                <tr key={index}>
                  <td>{product.description}</td>
                  <td>{product.category}</td>
                  <td>{formatCurrency(product.revenue)}</td>
                  <td>{formatCurrency(product.costOfGoodsSold)}</td>
                  <td>{formatCurrency(product.grossProfit)}</td>
                  <td>{formatPercentage(product.grossMargin)}</td>
                  <td>{product.unitsSold}</td>
                  <td>{formatCurrency(product.averageSellingPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="expense-management">
          <div className="expense-header">
            <h3>Operating Expenses</h3>
            <button className="btn-primary" onClick={() => setShowExpenseModal(true)}>
              Add Expense
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr key={index}>
                  <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                  <td>{expense.category}</td>
                  <td>{expense.description}</td>
                  <td>{formatCurrency(expense.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add Operating Expense</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleAddExpense({
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount') as string),
                description: formData.get('description'),
                recurring: formData.get('recurring') === 'on'
              });
            }}>
              <div className="form-group">
                <label>Category</label>
                <select name="category" required>
                  <option value="labor">Labor</option>
                  <option value="rent">Rent</option>
                  <option value="utilities">Utilities</option>
                  <option value="marketing">Marketing</option>
                  <option value="supplies">Supplies</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input type="number" name="amount" step="0.01" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" name="description" required />
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" name="recurring" />
                  Recurring Expense
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}