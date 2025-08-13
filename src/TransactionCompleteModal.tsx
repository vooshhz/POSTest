import { useState } from "react";
import ReceiptModal from "./ReceiptModal";
import "./TransactionCompleteModal.css";

interface TransactionCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  success: boolean;
  transaction?: {
    items: Array<{
      description: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    paymentType: 'cash' | 'debit' | 'credit';
    cashGiven?: number;
    changeGiven?: number;
    timestamp: string;
  };
  error?: string;
}

export default function TransactionCompleteModal({ 
  isOpen, 
  onClose, 
  success, 
  transaction,
  error 
}: TransactionCompleteModalProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  if (!isOpen) return null;

  const handleReceiptClick = () => {
    setShowReceipt(true);
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
  };

  const handleClose = () => {
    setShowReceipt(false);
    onClose();
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="transaction-complete-modal">
          <div className={`transaction-status ${success ? 'success' : 'failed'}`}>
            {success ? (
              <>
                <div className="status-icon">✓</div>
                <h2>Transaction Completed</h2>
                <p>The transaction has been processed successfully.</p>
                {transaction && (
                  <div className="transaction-summary">
                    <div className="summary-row">
                      <span>Total Amount:</span>
                      <span>${transaction.total.toFixed(2)}</span>
                    </div>
                    {transaction.paymentType === 'cash' && transaction.changeGiven !== undefined && (
                      <div className="summary-row change">
                        <span>Change Given:</span>
                        <span>${transaction.changeGiven.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="status-icon">✗</div>
                <h2>Transaction Failed</h2>
                <p>{error || "The transaction could not be processed."}</p>
              </>
            )}
          </div>
          
          <div className="modal-actions">
            {success && transaction && (
              <button 
                className="receipt-btn"
                onClick={handleReceiptClick}
              >
                📄 Receipt
              </button>
            )}
            <button 
              className="close-btn"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showReceipt && transaction && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={handleCloseReceipt}
          transaction={transaction}
        />
      )}
    </>
  );
}