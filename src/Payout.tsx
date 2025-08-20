import React, { useState } from 'react';
import PayoutKeypad from './PayoutKeypad';
import './Payout.css';

type PayoutType = 'selection' | 'lottery' | 'bottle' | 'other-description' | 'other-amount';

interface PayoutProps {
  onComplete?: (type: string, amount: number, description?: string) => void;
  onCancel?: () => void;
  initialType?: 'lottery' | 'bottle' | 'other';
}

const Payout: React.FC<PayoutProps> = ({ onComplete, onCancel, initialType }) => {
  const [currentView, setCurrentView] = useState<PayoutType>(
    initialType === 'lottery' ? 'lottery' : 
    initialType === 'bottle' ? 'bottle' : 
    'selection'
  );
  const [otherDescription, setOtherDescription] = useState('');
  const [selectedType, setSelectedType] = useState<'lottery' | 'bottle' | 'other'>(initialType || 'lottery');

  const handleTypeSelection = (type: 'lottery' | 'bottle' | 'other') => {
    setSelectedType(type);
    if (type === 'other') {
      setCurrentView('other-description');
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
    const typeLabel = selectedType === 'lottery' ? 'Lottery Payout' :
                      selectedType === 'bottle' ? 'Bottle/Can Return' :
                      `Other: ${otherDescription}`;
    
    if (onComplete) {
      onComplete(typeLabel, amount, selectedType === 'other' ? otherDescription : undefined);
    }
    
    // Reset state
    setCurrentView('selection');
    setOtherDescription('');
    setSelectedType('lottery');
  };

  const handleBack = () => {
    if (currentView === 'other-amount') {
      setCurrentView('other-description');
    } else if (currentView === 'other-description') {
      setCurrentView('selection');
      setOtherDescription('');
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
              onClick={() => handleTypeSelection('lottery')}
            >
              <div className="payout-icon">🎰</div>
              <div className="payout-label">Lottery</div>
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

      {(currentView === 'lottery' || currentView === 'bottle' || currentView === 'other-amount') && (
        <PayoutKeypad
          type={currentView === 'bottle' ? 'cents' : 'dollars'}
          title={
            currentView === 'lottery' ? 'Enter Lottery Payout Amount' :
            currentView === 'bottle' ? 'Enter Bottle/Can Return Amount' :
            `Enter Amount for: ${otherDescription}`
          }
          onComplete={handleAmountComplete}
          onCancel={handleBack}
        />
      )}
    </div>
  );
};

export default Payout;