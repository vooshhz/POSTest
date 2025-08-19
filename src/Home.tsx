import React from 'react';
import './Home.css';

interface HomeProps {
  onNavigate: (view: string) => void;
  userRole?: string;
}

const Home: React.FC<HomeProps> = ({ onNavigate, userRole }) => {
  // Determine if we have 5 buttons (admin/manager with time tracking)
  const hasFiveButtons = userRole === 'admin' || userRole === 'manager';
  const gridClassName = hasFiveButtons ? 'home-grid home-grid-five' : 'home-grid';
  
  return (
    <div className="home-container">
      <div className={gridClassName}>
        <button 
          className="home-button scanner-button"
          onClick={() => onNavigate('scanner')}
        >
          <div className="button-icon">🛒</div>
          <div className="button-title">Checkout</div>
          <div className="button-description">Point of Sale & Register</div>
        </button>

        <button 
          className="home-button inventory-button"
          onClick={() => onNavigate('inventory')}
        >
          <div className="button-icon">📦</div>
          <div className="button-title">Inventory</div>
          <div className="button-description">Manage Stock & Products</div>
        </button>

        <button 
          className="home-button transactions-button"
          onClick={() => onNavigate('transactions')}
        >
          <div className="button-icon">💵</div>
          <div className="button-title">Transactions</div>
          <div className="button-description">View Sales History</div>
        </button>

        {userRole !== 'cashier' && (
          <button 
            className="home-button reports-button"
            onClick={() => onNavigate('reports')}
          >
            <div className="button-icon">📊</div>
            <div className="button-title">Reports</div>
            <div className="button-description">Analytics & Insights</div>
          </button>
        )}

        {(userRole === 'admin' || userRole === 'manager') && (
          <button 
            className="home-button timetracking-button"
            onClick={() => onNavigate('timetracking')}
          >
            <div className="button-icon">⏰</div>
            <div className="button-title">Time Tracking</div>
            <div className="button-description">Employee Hours & Shifts</div>
          </button>
        )}
      </div>
    </div>
  );
};

export default Home;