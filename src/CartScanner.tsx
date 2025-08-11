import { useState, useRef, useEffect } from "react";
import "./CartScanner.css";

interface CartItem {
  upc: string;
  description: string | null;
  volume: string | null;
  quantity: number;
  cost: number;
  price: number;
}

interface CartScannerProps {
  barcode: string;
  setBarcode: (value: string) => void;
  cart: CartItem[];
  setCart: (value: CartItem[]) => void;
  error: string;
  setError: (value: string) => void;
}

export default function CartScanner({ barcode, setBarcode, cart, setCart, error, setError }: CartScannerProps) {
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scannedUpc, setScannedUpc] = useState("");
  const [inventoryForm, setInventoryForm] = useState({
    cost: "",
    price: "",
    quantity: ""
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'debit' | null>(null);
  const [amountTendered, setAmountTendered] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const closeAddModal = () => {
    setShowAddModal(false);
    setInventoryForm({ cost: "", price: "", quantity: "" });
    setScannedUpc("");
    inputRef.current?.focus();
  };

  // Handle ESC key for modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddModal) {
        closeAddModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAddModal]);

  const handleScan = async () => {
    if (!barcode.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Check if item exists in inventory
      const result = await window.api.checkInventory(barcode.trim());
      
      if (result.success && result.data) {
        // Check if item already in cart
        const existingIndex = cart.findIndex(item => item.upc === result.data!.upc);
        
        if (existingIndex >= 0) {
          // Update quantity if already in cart
          const updatedCart = [...cart];
          updatedCart[existingIndex].quantity += 1;
          setCart(updatedCart);
        } else {
          // Add new item to cart
          const newItem: CartItem = {
            upc: result.data.upc,
            description: result.data.description,
            volume: result.data.volume,
            quantity: 1,
            cost: result.data.cost,
            price: result.data.price
          };
          setCart([...cart, newItem]);
        }
        
        // Clear input for next scan
        setBarcode("");
        inputRef.current?.focus();
      } else {
        // Instead of showing error, open modal to add to inventory
        setScannedUpc(barcode.trim());
        setShowAddModal(true);
        setBarcode("");
      }
    } catch (err) {
      setError("Failed to add item to cart");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan();
    }
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
    } else {
      const updatedCart = [...cart];
      updatedCart[index].quantity = newQuantity;
      setCart(updatedCart);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setBarcode("");
    inputRef.current?.focus();
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.06; // Michigan 6% sales tax
    const total = subtotal + tax;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      totalItems,
      subtotal,
      tax,
      total
    };
  };

  const voidCart = () => {
    if (confirm("Are you sure you want to void the entire cart?")) {
      setCart([]);
      setBarcode("");
      inputRef.current?.focus();
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentMethod(null);
    setAmountTendered("");
  };

  const processPayment = async () => {
    if (paymentMethod === 'cash') {
      const tendered = parseFloat(amountTendered);
      if (isNaN(tendered) || tendered < totals.total) {
        alert("Insufficient payment amount");
        return;
      }
    }

    // Save transaction to database
    try {
      const cashGiven = paymentMethod === 'cash' ? parseFloat(amountTendered) : undefined;
      const changeGiven = paymentMethod === 'cash' ? cashGiven! - totals.total : undefined;
      
      // Prepare items data as JSON string
      const itemsData = cart.map(item => ({
        description: item.description || 'Unknown Item',
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));
      
      const transaction = {
        items: JSON.stringify(itemsData),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        payment_type: paymentMethod as 'cash' | 'debit' | 'credit',
        cash_given: cashGiven,
        change_given: changeGiven
      };
      
      const result = await window.api.saveTransaction(transaction);
      
      if (result.success) {
        // Simulate payment processing
        setTimeout(() => {
          setShowPaymentModal(false);
          setCart([]);
          setBarcode("");
          setPaymentMethod(null);
          setAmountTendered("");
          setShowSuccess(true);
          
          // Hide success message after 3 seconds
          setTimeout(() => {
            setShowSuccess(false);
            inputRef.current?.focus();
          }, 3000);
        }, paymentMethod === 'cash' ? 100 : 1500);
      } else {
        alert("Failed to save transaction: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Transaction save error:", err);
      alert("Failed to save transaction");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleAddToInventory = async () => {
    const cost = parseFloat(inventoryForm.cost);
    const price = parseFloat(inventoryForm.price);
    const quantity = parseInt(inventoryForm.quantity);

    if (isNaN(cost) || isNaN(price) || isNaN(quantity)) {
      alert("Please enter valid numbers");
      return;
    }

    if (cost < 0 || price < 0 || quantity < 1) {
      alert("Please enter positive values");
      return;
    }

    setLoading(true);

    try {
      const result = await window.api.addToInventory({
        upc: scannedUpc,
        cost,
        price,
        quantity
      });

      if (result.success) {
        // After successfully adding to inventory, try to add to cart
        const checkResult = await window.api.checkInventory(scannedUpc);
        if (checkResult.success && checkResult.data) {
          const newItem: CartItem = {
            upc: checkResult.data.upc,
            description: checkResult.data.description,
            volume: checkResult.data.volume,
            quantity: 1,
            cost: checkResult.data.cost,
            price: checkResult.data.price
          };
          setCart([...cart, newItem]);
        }
        closeAddModal();
      } else {
        alert(result.error || "Failed to add to inventory");
      }
    } catch (err) {
      alert("Failed to add to inventory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="cart-scanner-container">
      <h2>Point of Sale</h2>
      
      <div className="scanner-section">
        <div className="scanner-input-group">
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Scan or enter UPC"
            className="scanner-input"
            disabled={loading}
          />
          <button 
            onClick={handleScan}
            className="scan-btn"
            disabled={loading}
          >
            Add
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        {showSuccess && (
          <div className="success-message">
            ✅ Payment successful! Transaction completed.
          </div>
        )}
      </div>

      <div className="cart-section">
        <div className="cart-header">
          <h3>Cart ({cart.length} items)</h3>
          {cart.length > 0 && (
            <button onClick={clearCart} className="clear-cart-btn">
              Clear Cart
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="empty-cart">Cart is empty</div>
        ) : (
          <>
            <div className="cart-items">
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Volume</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={index}>
                      <td className="item-number">{index + 1}</td>
                      <td className="description-cell">{item.description || "N/A"}</td>
                      <td>{item.volume ? `${item.volume} mL` : "N/A"}</td>
                      <td>
                        <div className="quantity-controls">
                          <button 
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            className="qty-btn"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 0)}
                            className="qty-input"
                            min="0"
                          />
                          <button 
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            className="qty-btn"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>{formatCurrency(item.price)}</td>
                      <td className="total-cell">{formatCurrency(item.price * item.quantity)}</td>
                      <td>
                        <button 
                          onClick={() => removeFromCart(index)}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cart-summary">
              <div className="summary-totals">
                <div className="summary-row">
                  <span>Total Items:</span>
                  <span>{totals.totalItems}</span>
                </div>
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Tax (6%):</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
              <div className="cart-action-buttons">
                <button className="void-cart-btn" onClick={voidCart}>
                  Void
                </button>
                <button className="checkout-btn" onClick={handleCheckout}>
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Payment - Total: {formatCurrency(totals.total)}</h3>
              <button className="modal-close-btn" onClick={closePaymentModal}>×</button>
            </div>
            
            {!paymentMethod ? (
              <div className="payment-methods">
                <h4>Select Payment Method:</h4>
                <div className="payment-buttons">
                  <button 
                    className="payment-method-btn cash-btn"
                    onClick={() => setPaymentMethod('cash')}
                  >
                    💵 Cash
                  </button>
                  <button 
                    className="payment-method-btn credit-btn"
                    onClick={() => setPaymentMethod('credit')}
                  >
                    💳 Credit Card
                  </button>
                  <button 
                    className="payment-method-btn debit-btn"
                    onClick={() => setPaymentMethod('debit')}
                  >
                    💳 Debit Card
                  </button>
                </div>
              </div>
            ) : (
              <div className="payment-process">
                {paymentMethod === 'cash' ? (
                  <div className="cash-payment">
                    <div className="amount-due">
                      <strong>Amount Due:</strong> {formatCurrency(totals.total)}
                    </div>
                    <div className="form-group">
                      <label>Amount Tendered:</label>
                      <input
                        type="number"
                        step="0.01"
                        min={totals.total.toString()}
                        value={amountTendered}
                        onChange={(e) => setAmountTendered(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    {amountTendered && parseFloat(amountTendered) >= totals.total && (
                      <div className="change-due">
                        <strong>Change Due:</strong> {formatCurrency(parseFloat(amountTendered) - totals.total)}
                      </div>
                    )}
                    <div className="modal-buttons">
                      <button 
                        onClick={processPayment} 
                        className="complete-sale-btn"
                        disabled={!amountTendered || parseFloat(amountTendered) < totals.total}
                      >
                        Complete Sale
                      </button>
                      <button onClick={() => setPaymentMethod(null)} className="back-btn">
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card-payment">
                    <div className="amount-due">
                      <strong>Amount Due:</strong> {formatCurrency(totals.total)}
                    </div>
                    <div className="processing">
                      <div className="spinner"></div>
                      <p>Processing {paymentMethod} card payment...</p>
                    </div>
                    <div className="modal-buttons">
                      <button 
                        onClick={processPayment} 
                        className="complete-sale-btn"
                      >
                        Process Payment
                      </button>
                      <button onClick={() => setPaymentMethod(null)} className="back-btn">
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to Inventory Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add to Inventory - {scannedUpc}</h3>
              <button className="modal-close-btn" onClick={closeAddModal}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>Cost ($):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inventoryForm.cost}
                  onChange={(e) => setInventoryForm({...inventoryForm, cost: e.target.value})}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Price ($):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={inventoryForm.price}
                  onChange={(e) => setInventoryForm({...inventoryForm, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  value={inventoryForm.quantity}
                  onChange={(e) => setInventoryForm({...inventoryForm, quantity: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="modal-buttons">
                <button onClick={handleAddToInventory} className="add-btn" disabled={loading}>
                  {loading ? "Adding..." : "Add"}
                </button>
                <button onClick={closeAddModal} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}