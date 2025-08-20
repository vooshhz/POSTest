import "./ReceiptModal.css";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    items: Array<{
      description: string;
      quantity: number;
      price: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    creditTotal?: number;
    total: number;
    paymentType: 'cash' | 'debit' | 'credit';
    cashGiven?: number;
    changeGiven?: number;
    timestamp: string;
  };
}

export default function ReceiptModal({ isOpen, onClose, transaction }: ReceiptModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    };
  };

  const { date, time } = formatDateTime(transaction.timestamp);

  return (
    <div className="modal-overlay">
      <div className="receipt-modal">
        <div className="receipt-container">
          <div className="receipt">
            <div className="receipt-header">
              <h2>LIQUOR STORE</h2>
              <p>123 Main Street</p>
              <p>City, State 12345</p>
              <p>(555) 123-4567</p>
              <div className="receipt-divider">================================</div>
            </div>

            <div className="receipt-datetime">
              <p>Date: {date}</p>
              <p>Time: {time}</p>
              <div className="receipt-divider">================================</div>
            </div>

            <div className="receipt-items">
              {transaction.items.map((item, index) => (
                <div key={index} className="receipt-item">
                  <div className="item-desc">
                    {item.description}
                  </div>
                  <div className="item-details">
                    <span>{item.quantity} x ${item.price.toFixed(2)}</span>
                    <span className="item-total">${item.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="receipt-divider">--------------------------------</div>
            </div>

            <div className="receipt-totals">
              <div className="total-row">
                <span>Subtotal:</span>
                <span>${transaction.subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Tax:</span>
                <span>${transaction.tax.toFixed(2)}</span>
              </div>
              {transaction.creditTotal && (
                <div className="total-row">
                  <span>Credits:</span>
                  <span>${transaction.creditTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="receipt-divider">--------------------------------</div>
              <div className="total-row total">
                <span>TOTAL:</span>
                <span>${transaction.total.toFixed(2)}</span>
              </div>
              <div className="receipt-divider">================================</div>
            </div>

            <div className="receipt-payment">
              <div className="payment-row">
                <span>Payment Method:</span>
                <span>{transaction.paymentType.toUpperCase()}</span>
              </div>
              {transaction.paymentType === 'cash' && (
                <>
                  <div className="payment-row">
                    <span>Cash Given:</span>
                    <span>${transaction.cashGiven?.toFixed(2)}</span>
                  </div>
                  <div className="payment-row">
                    <span>Change:</span>
                    <span>${transaction.changeGiven?.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="receipt-divider">================================</div>
            </div>

            <div className="receipt-footer">
              <p>Thank you for your purchase!</p>
              <p>Have a great day!</p>
              <div className="receipt-divider">================================</div>
              <p className="receipt-id">Transaction ID: {Date.now()}</p>
            </div>
          </div>
        </div>

        <div className="receipt-actions">
          <button className="print-btn" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}