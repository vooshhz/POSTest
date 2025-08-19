import React, { useState, useEffect } from 'react';
import './PayoutKeypad.css';

interface PayoutKeypadProps {
  type: 'dollars' | 'cents';
  title: string;
  onComplete: (amount: number) => void;
  onCancel: () => void;
}

const PayoutKeypad: React.FC<PayoutKeypadProps> = ({ type, title, onComplete, onCancel }) => {
  const [inputValue, setInputValue] = useState('0');
  const [displayValue, setDisplayValue] = useState('$0.00');

  useEffect(() => {
    updateDisplayValue(inputValue);
  }, [inputValue, type]);

  const updateDisplayValue = (value: string) => {
    if (type === 'cents') {
      // For cents mode, always show as cents then convert to dollars
      const cents = parseInt(value) || 0;
      const dollars = cents / 100;
      setDisplayValue(`$${dollars.toFixed(2)}`);
    } else {
      // For dollars mode, input is in cents but display as dollars
      const cents = parseInt(value) || 0;
      const dollars = cents / 100;
      setDisplayValue(`$${dollars.toFixed(2)}`);
    }
  };

  const handleNumberClick = (num: string) => {
    if (inputValue === '0') {
      setInputValue(num);
    } else if (inputValue.length < 8) { // Limit to reasonable amount
      setInputValue(inputValue + num);
    }
  };

  const handleClear = () => {
    setInputValue('0');
  };

  const handleBackspace = () => {
    if (inputValue.length > 1) {
      setInputValue(inputValue.slice(0, -1));
    } else {
      setInputValue('0');
    }
  };

  const handleComplete = () => {
    const cents = parseInt(inputValue) || 0;
    const amount = cents / 100;
    if (amount > 0) {
      onComplete(amount);
      setInputValue('0');
    }
  };

  const getInputLabel = () => {
    if (type === 'cents') {
      const cents = parseInt(inputValue) || 0;
      return `${cents} ¢`;
    }
    return displayValue;
  };

  return (
    <div className="payout-keypad-container">
      <h3>{title}</h3>
      
      <div className="amount-display">
        <div className="amount-value">{displayValue}</div>
        {type === 'cents' && (
          <div className="cents-display">{parseInt(inputValue) || 0} cents</div>
        )}
      </div>

      <div className="keypad-grid">
        <button className="keypad-btn" onClick={() => handleNumberClick('1')}>1</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('2')}>2</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('3')}>3</button>
        
        <button className="keypad-btn" onClick={() => handleNumberClick('4')}>4</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('5')}>5</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('6')}>6</button>
        
        <button className="keypad-btn" onClick={() => handleNumberClick('7')}>7</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('8')}>8</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('9')}>9</button>
        
        <button className="keypad-btn clear-btn" onClick={handleClear}>Clear</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('0')}>0</button>
        <button className="keypad-btn backspace-btn" onClick={handleBackspace}>⌫</button>
      </div>

      {type === 'dollars' && (
        <div className="quick-amounts">
          <button className="quick-btn" onClick={() => { setInputValue('500'); }}>$5</button>
          <button className="quick-btn" onClick={() => { setInputValue('1000'); }}>$10</button>
          <button className="quick-btn" onClick={() => { setInputValue('2000'); }}>$20</button>
          <button className="quick-btn" onClick={() => { setInputValue('5000'); }}>$50</button>
          <button className="quick-btn" onClick={() => { setInputValue('10000'); }}>$100</button>
        </div>
      )}

      {type === 'cents' && (
        <div className="quick-amounts">
          <button className="quick-btn" onClick={() => { setInputValue('5'); }}>5¢</button>
          <button className="quick-btn" onClick={() => { setInputValue('10'); }}>10¢</button>
          <button className="quick-btn" onClick={() => { setInputValue('25'); }}>25¢</button>
          <button className="quick-btn" onClick={() => { setInputValue('100'); }}>$1</button>
          <button className="quick-btn" onClick={() => { setInputValue('500'); }}>$5</button>
        </div>
      )}

      <div className="keypad-actions">
        <button className="cancel-btn" onClick={onCancel}>Cancel</button>
        <button 
          className="complete-btn" 
          onClick={handleComplete}
          disabled={parseInt(inputValue) === 0}
        >
          Complete Payout
        </button>
      </div>
    </div>
  );
};

export default PayoutKeypad;