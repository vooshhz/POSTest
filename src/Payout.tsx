import React, { useState } from 'react';
import PayoutKeypad from './PayoutKeypad';
import './Payout.css';

type PayoutType = 'selection' | 'buy-lottery' | 'lottery-payout' | 'bottle' | 'misc-tax' | 'misc-non-tax' | 'other-description' | 'other-amount';

interface PayoutProps {
  onComplete?: (type: string, amount: number, description?: string) => void;
  onCancel?: () => void;
  initialType?: 'lottery-payout' | 'bottle' | 'other' | null;
}

const Payout: React.FC<PayoutProps> = ({ onComplete, onCancel, initialType }) => {
  const [currentView, setCurrentView] = useState<PayoutType>(
    initialType === 'other' ? 'other-description' : (initialType ? initialType : 'selection')
  );
  const [otherDescription, setOtherDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'buy-lottery' | 'lottery-payout' | 'bottle' | 'misc-tax' | 'misc-non-tax' | 'other'>(
    initialType === 'other' ? 'other' : (initialType || 'lottery-payout')
  );

  const handleTypeSelection = (type: 'buy-lottery' | 'lottery-payout' | 'bottle' | 'misc-tax' | 'misc-non-tax' | 'other') => {
    setSelectedType(type);
    if (type === 'other') {
      setCurrentView('other-description');
    } else if (type === 'misc-tax' || type === 'misc-non-tax') {
      setCurrentView(type);
    } else {
      setCurrentView(type);
    }
  };

  const handleOtherDescriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otherDescription.trim()) {
      setCurrentView('other-amount');
    }
  };

  const handleAmountComplete = (amount: number) => {
    const typeLabel = selectedType === 'buy-lottery' ? 'Buy Lottery' :
                      selectedType === 'lottery-payout' ? 'Lottery Payout' :
                      selectedType === 'bottle' ? 'Bottle/Can Return' :
                      selectedType === 'misc-tax' ? 'Misc Tax' :
                      selectedType === 'misc-non-tax' ? 'Misc Non-Tax' :
                      `Other: ${otherDescription}`;
    
    if (onComplete) {
      onComplete(typeLabel, amount, selectedType === 'other' ? otherDescription : undefined);
    }
    
    // Reset state
    setCurrentView('selection');
    setOtherDescription('');
    setSelectedType('lottery-payout');
  };

  const handleBack = () => {
    if (currentView === 'other-amount') {
      setCurrentView('other-description');
    } else if (currentView === 'other-description') {
      // If we started with 'other' type, cancel directly
      if (initialType === 'other' && onCancel) {
        onCancel();
      } else {
        setCurrentView('selection');
        setOtherDescription('');
      }
    } else if (currentView !== 'selection') {
      setCurrentView('selection');
    } else if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="payout-container">
      <div className="payout-header">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>
        <h2>Payouts</h2>
      </div>

      {currentView === 'selection' && (
        <div className="payout-selection">
          <h3>Select Payout Type</h3>
          <div className="payout-buttons">
            <button 
              className="payout-type-button lottery"
              onClick={() => handleTypeSelection('buy-lottery')}
            >
              <div className="payout-icon">🎰</div>
              <div className="payout-label">Buy Lottery</div>
              <div className="payout-desc">Lottery purchase</div>
            </button>

            <button 
              className="payout-type-button lottery"
              onClick={() => handleTypeSelection('lottery-payout')}
            >
              <div className="payout-icon">💰</div>
              <div className="payout-label">Lottery Payout</div>
              <div className="payout-desc">Lottery winnings payout</div>
            </button>

            <button 
              className="payout-type-button bottle"
              onClick={() => handleTypeSelection('bottle')}
            >
              <div className="payout-icon">🍾</div>
              <div className="payout-label">Bottle/Can</div>
              <div className="payout-desc">Container deposit return</div>
            </button>

            <button 
              className="payout-type-button misc-tax"
              onClick={() => handleTypeSelection('misc-tax')}
            >
              <div className="payout-icon">📋</div>
              <div className="payout-label">Misc Tax</div>
              <div className="payout-desc">Miscellaneous taxable</div>
            </button>

            <button 
              className="payout-type-button misc-non-tax"
              onClick={() => handleTypeSelection('misc-non-tax')}
            >
              <div className="payout-icon">📄</div>
              <div className="payout-label">Misc Non-Tax</div>
              <div className="payout-desc">Miscellaneous non-taxable</div>
            </button>

            <button 
              className="payout-type-button other"
              onClick={() => handleTypeSelection('other')}
            >
              <div className="payout-icon">💵</div>
              <div className="payout-label">Other</div>
              <div className="payout-desc">Other payouts & credits</div>
            </button>
          </div>
        </div>
      )}

      {currentView === 'other-description' && (
        <div className="payout-description">
          <h3>Enter Payout Description</h3>
          <form onSubmit={handleOtherDescriptionSubmit}>
            <input
              type="text"
              className="description-input"
              placeholder="Enter description (e.g., Vendor refund, Customer credit...)"
              value={otherDescription}
              onChange={(e) => setOtherDescription(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="continue-button">
              Continue
            </button>
          </form>
        </div>
      )}

      {(currentView === 'buy-lottery' || currentView === 'lottery-payout' || currentView === 'bottle' || currentView === 'misc-tax' || currentView === 'misc-non-tax' || currentView === 'other-amount') && (
        <PayoutKeypad
          type={currentView === 'bottle' ? 'cents' : 'dollars'}
          title={
            currentView === 'buy-lottery' ? 'Enter Buy Lottery Amount' :
            currentView === 'lottery-payout' ? 'Enter Lottery Payout Amount' :
            currentView === 'bottle' ? 'Enter Bottle/Can Return Amount' :
            currentView === 'misc-tax' ? 'Enter Misc Tax Amount' :
            currentView === 'misc-non-tax' ? 'Enter Misc Non-Tax Amount' :
            `Enter Amount for: ${otherDescription}`
          }
          isMiscPayout={currentView === 'misc-tax' || currentView === 'misc-non-tax'}
          onComplete={handleAmountComplete}
          onCancel={handleBack}
        />
      )}
    </div>
  );
};

export default Payout;