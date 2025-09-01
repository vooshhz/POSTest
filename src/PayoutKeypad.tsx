import React, { useState, useEffect, useCallback } from 'react';
import './PayoutKeypad.css';

interface PayoutKeypadProps {
  type: 'dollars' | 'cents';
  title: string;
  onComplete: (amount: number) => void;
  onCancel: () => void;
  isMiscPayout?: boolean;
}

const PayoutKeypad: React.FC<PayoutKeypadProps> = ({ type, title, onComplete, onCancel, isMiscPayout = false }) => {
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

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Number keys (both numpad and regular)
    if ((e.key >= '0' && e.key <= '9') || (e.code >= 'Numpad0' && e.code <= 'Numpad9')) {
      e.preventDefault();
      const num = e.key >= '0' && e.key <= '9' ? e.key : e.code.slice(-1);
      handleNumberClick(num);
    }
    // Backspace
    else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    }
    // Delete or Clear
    else if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      handleClear();
    }
    // Enter to complete
    else if (e.key === 'Enter') {
      e.preventDefault();
      handleComplete();
    }
    // Escape to cancel
    else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [inputValue]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /* const getInputLabel = () => {
    if (type === 'cents') {
      const cents = parseInt(inputValue) || 0;
      return `${cents} ¢`;
    }
    return displayValue;
  }; */

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
        <button className="keypad-btn" onClick={() => handleNumberClick('7')}>7</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('8')}>8</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('9')}>9</button>
        
        <button className="keypad-btn" onClick={() => handleNumberClick('4')}>4</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('5')}>5</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('6')}>6</button>
        
        <button className="keypad-btn" onClick={() => handleNumberClick('1')}>1</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('2')}>2</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('3')}>3</button>
        
        <button className="keypad-btn clear-btn" onClick={handleClear}>C</button>
        <button className="keypad-btn" onClick={() => handleNumberClick('0')}>0</button>
        <button className="keypad-btn backspace-btn" onClick={handleBackspace}>←</button>
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
          {isMiscPayout ? 'Pay Add' : 'Complete Payout'}
        </button>
      </div>
    </div>
  );
};

export default PayoutKeypad;