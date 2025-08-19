import React from 'react';
import './Home.css';

interface HomeProps {
  onNavigate: (view: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div className="home-container">
      <div className="home-grid">
        <button 
          className="home-button scanner-button"
          onClick={() => onNavigate('scanner')}
        >
          <div className="button-icon">📷</div>
          <div className="button-title">Scanner</div>
          <div className="button-description">Point of Sale & Checkout</div>
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

        <button 
          className="home-button reports-button"
          onClick={() => onNavigate('reports')}
        >
          <div className="button-icon">📊</div>
          <div className="button-title">Reports</div>
          <div className="button-description">Analytics & Insights</div>
        </button>
      </div>
    </div>
  );
};

export default Home;