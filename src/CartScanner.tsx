import { useState, useRef, useEffect } from "react";
import "./CartScanner.css";
import TransactionCompleteModal from "./TransactionCompleteModal";

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
  const [showTransactionComplete, setShowTransactionComplete] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [transactionData, setTransactionData] = useState<{
    items: Array<{
      upc: string;
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
  } | undefined>(undefined);
  const [transactionError, setTransactionError] = useState("");
  const [manualEntry, setManualEntry] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    upc: string;
    description: string | null;
    volume: string | null;
    price: number;
    quantity: number;
  }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search inventory when input changes
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (barcode.length > 2 && isNaN(Number(barcode))) {
        // It's text, not a UPC
        try {
          const result = await window.api.searchInventoryByDescription(barcode);
          if (result.success && result.data) {
            setSearchResults(result.data.slice(0, 5)); // Limit to 5 results
            setShowDropdown(true); // Always show dropdown when searching
            setSelectedIndex(0);
          } else {
            setSearchResults([]);
            setShowDropdown(true); // Show dropdown even with no results
          }
        } catch (err) {
          console.error("Search error:", err);
          setSearchResults([]);
          setShowDropdown(true); // Show dropdown even on error
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300); // Debounce for 300ms

    return () => clearTimeout(searchTimer);
  }, [barcode]);

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

  const selectSearchItem = async (item: typeof searchResults[0]) => {
    // Check if item already in cart
    const existingIndex = cart.findIndex(cartItem => cartItem.upc === item.upc);
    
    if (existingIndex >= 0) {
      // Update quantity if already in cart
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      // Add new item to cart
      const newItem: CartItem = {
        upc: item.upc,
        description: item.description,
        volume: item.volume,
        quantity: 1,
        cost: 0, // We don't have cost from search
        price: item.price
      };
      setCart([...cart, newItem]);
    }
    
    // Clear input and hide dropdown
    setBarcode("");
    setShowDropdown(false);
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % searchResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? searchResults.length - 1 : prev - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          selectSearchItem(searchResults[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setSearchResults([]);
      }
    } else if (e.key === "Enter") {
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
        upc: item.upc,
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
          // Prepare transaction data for receipt
          const transactionComplete = {
            items: itemsData,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            paymentType: paymentMethod as 'cash' | 'debit' | 'credit',
            cashGiven: cashGiven,
            changeGiven: changeGiven,
            timestamp: new Date().toISOString()
          };
          
          setTransactionData(transactionComplete);
          setTransactionSuccess(true);
          setShowPaymentModal(false);
          setShowTransactionComplete(true);
          
          // Reset cart and payment state
          setCart([]);
          setBarcode("");
          setPaymentMethod(null);
          setAmountTendered("");
        }, paymentMethod === 'cash' ? 100 : 1500);
      } else {
        // Show error in transaction complete modal
        setTransactionSuccess(false);
        setTransactionError(result.error || "Transaction failed");
        setShowPaymentModal(false);
        setShowTransactionComplete(true);
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

  // Number pad functions
  const handleNumberPadClick = (value: string) => {
    if (value === 'C') {
      setManualEntry("");
    } else if (value === '←') {
      setManualEntry(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!manualEntry.includes('.')) {
        setManualEntry(prev => prev + value);
      }
    } else if (value === 'Enter') {
      handleManualPriceAdd();
    } else {
      // Limit to 2 decimal places if decimal exists
      if (manualEntry.includes('.')) {
        const parts = manualEntry.split('.');
        if (parts[1].length < 2) {
          setManualEntry(prev => prev + value);
        }
      } else {
        setManualEntry(prev => prev + value);
      }
    }
  };

  const handleManualPriceAdd = () => {
    if (!manualEntry || parseFloat(manualEntry) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const price = parseFloat(manualEntry);
    const manualItem: CartItem = {
      upc: `MANUAL-${Date.now()}`,
      description: "Manual Entry",
      volume: null,
      quantity: 1,
      cost: 0,
      price: price
    };

    setCart([...cart, manualItem]);
    setManualEntry("");
    setError("");
  };

  const formatDisplayAmount = (amount: string) => {
    if (!amount) return "$0.00";
    const num = parseFloat(amount);
    if (isNaN(num)) return "$0.00";
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="cart-scanner-container">
      <h2>Point of Sale</h2>
      
      <div className="main-content">
        {/* Left Section - Scanner and Cart */}
        <div className="left-section">
          <div className="scanner-section">
            <div className="scanner-input-wrapper">
              <div className="scanner-input-group">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Scan or enter UPC / Search by name"
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
              
              {showDropdown && barcode.length > 2 && isNaN(Number(barcode)) && (
                <div className="search-dropdown" ref={dropdownRef}>
                  {searchResults.length > 0 ? (
                    searchResults.map((item, index) => (
                      <div 
                        key={item.upc}
                        className={`search-item ${index === selectedIndex ? 'selected' : ''}`}
                        onClick={() => selectSearchItem(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="search-item-left">
                          <span className="search-item-name">{item.description}</span>
                          {item.volume && <span className="search-item-volume">{item.volume} mL</span>}
                        </div>
                        <div className="search-item-right">
                          <span className="search-item-qty">Qty: {item.quantity}</span>
                          <span className="search-item-price">${item.price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="search-no-results">
                      Cannot find "{barcode}" in inventory
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="cart-section">
        <div className="cart-header">
          <h3>Cart ({cart.length} items)</h3>
          {cart.length > 0 && (
            <div className="cart-actions">
              <button onClick={clearCart} className="clear-cart-btn">
                Clear Cart
              </button>
            </div>
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
          </>
        )}
          </div>
        </div>

        {/* Right Section - Manual Entry Panel */}
        <div className="manual-entry-panel">
          <div className="amount-display">
            {formatDisplayAmount(manualEntry)}
          </div>
          <div className="number-pad">
            <div className="number-pad-row">
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('7')}>7</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('8')}>8</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('9')}>9</button>
              <button className="num-pad-btn clear" onClick={() => handleNumberPadClick('C')}>C</button>
            </div>
            <div className="number-pad-row">
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('4')}>4</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('5')}>5</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('6')}>6</button>
              <button className="num-pad-btn backspace" onClick={() => handleNumberPadClick('←')}>←</button>
            </div>
            <div className="number-pad-row">
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('1')}>1</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('2')}>2</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('3')}>3</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('00')}>00</button>
            </div>
            <div className="number-pad-row">
              <button className="num-pad-btn zero" onClick={() => handleNumberPadClick('0')}>0</button>
              <button className="num-pad-btn" onClick={() => handleNumberPadClick('.')}>.</button>
              <button className="num-pad-btn enter" onClick={() => handleNumberPadClick('Enter')}>Add</button>
            </div>
          </div>
          
          {/* Cart Summary moved here */}
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
        </div>
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

      {/* Transaction Complete Modal */}
      <TransactionCompleteModal
        isOpen={showTransactionComplete}
        onClose={() => {
          setShowTransactionComplete(false);
          setTransactionSuccess(false);
          setTransactionData(undefined);
          setTransactionError("");
          inputRef.current?.focus();
        }}
        success={transactionSuccess}
        transaction={transactionData ? {
          ...transactionData,
          items: transactionData.items.map(({ description, quantity, price, total }) => ({
            description,
            quantity,
            price,
            total
          }))
        } : undefined}
        error={transactionError}
      />
    </div>
  );
}