import { useState, useRef, useEffect } from "react";
import "./CartScanner.css";
import TransactionCompleteModal from "./TransactionCompleteModal";
import TillDashboard from "./TillDashboard";

interface CartItem {
  upc: string;
  description: string | null;
  volume: string | null;
  quantity: number;
  cost: number;
  price: number;
  discount?: number;
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
  const [activeTab, setActiveTab] = useState<'scanner' | 'till'>('scanner');
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
  const [isQuickCash, setIsQuickCash] = useState(false);
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
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountItemIndex, setDiscountItemIndex] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add a slight delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.click(); // Try clicking too
      }
    }, 100);
    return () => clearTimeout(timer);
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
    const subtotal = cart.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const discount = (item.discount || 0) * item.quantity;
      return sum + (itemTotal - discount);
    }, 0);
    const tax = subtotal * 0.06; // Michigan 6% sales tax
    const total = subtotal + tax;
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalDiscount = cart.reduce((sum, item) => sum + ((item.discount || 0) * item.quantity), 0);
    
    return {
      totalItems,
      subtotal,
      tax,
      total,
      totalDiscount
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
    setIsQuickCash(false);
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

  const openDiscountModal = (index: number) => {
    setDiscountItemIndex(index);
    setDiscountAmount("");
    setShowDiscountModal(true);
  };

  const applyPercentageDiscount = (percentage: number) => {
    if (discountItemIndex === null) return;
    const item = cart[discountItemIndex];
    const discountValue = (item.price * percentage) / 100;
    setDiscountAmount(discountValue.toFixed(2));
  };

  const applyDiscount = () => {
    if (discountItemIndex === null) return;
    const discount = parseFloat(discountAmount);
    if (isNaN(discount) || discount < 0) {
      alert("Please enter a valid discount amount");
      return;
    }
    
    const item = cart[discountItemIndex];
    if (discount > item.price) {
      alert("Discount cannot exceed item price");
      return;
    }

    const updatedCart = [...cart];
    updatedCart[discountItemIndex] = { ...item, discount };
    setCart(updatedCart);
    setShowDiscountModal(false);
    setDiscountAmount("");
    setDiscountItemIndex(null);
  };

  const removeDiscount = (index: number) => {
    const updatedCart = [...cart];
    updatedCart[index] = { ...cart[index], discount: undefined };
    setCart(updatedCart);
  };

  const handlePopulate = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Get current inventory with stock levels
      const inventoryResult = await window.api.getInventory();
      if (!inventoryResult.success || !inventoryResult.data) {
        setError("Failed to load inventory");
        return;
      }
      
      // Filter for items with quantity > 0
      const availableItems = inventoryResult.data.filter((item: any) => 
        item.quantity > 0 && item.description
      );
      
      if (availableItems.length === 0) {
        setError("No items available in inventory");
        return;
      }
      
      // Randomly select 1-5 items
      const numItems = Math.floor(Math.random() * 5) + 1;
      const selectedItems: CartItem[] = [];
      const usedUpcs = new Set<string>();
      
      for (let i = 0; i < numItems && i < availableItems.length; i++) {
        // Pick a random item that hasn't been selected yet
        let randomItem: any;
        do {
          randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        } while (usedUpcs.has(randomItem.upc) && usedUpcs.size < availableItems.length);
        
        if (usedUpcs.has(randomItem.upc)) continue;
        usedUpcs.add(randomItem.upc);
        
        // Random quantity between 1-2, but not more than available
        const maxQty = Math.min(2, randomItem.quantity);
        const qty = Math.floor(Math.random() * maxQty) + 1;
        
        selectedItems.push({
          upc: randomItem.upc,
          description: randomItem.description,
          volume: randomItem.volume,
          quantity: qty,
          cost: randomItem.cost,
          price: randomItem.price
        });
      }
      
      // Add items to cart
      setCart(selectedItems);
      setError("");
      
    } catch (err) {
      console.error("Error populating cart:", err);
      setError("Failed to populate cart");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cart-scanner-container">
      <div className="pos-header">
        <h2>Point of Sale</h2>
        <div className="pos-header-controls">
          <button 
            className="populate-btn"
            onClick={handlePopulate}
            disabled={loading}
            style={{ display: activeTab === 'scanner' ? 'block' : 'none' }}
          >
            {loading ? 'Loading...' : 'Populate'}
          </button>
          <div className="pos-tabs">
            <button 
              className={`tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => setActiveTab('scanner')}
            >
              Scanner
            </button>
            <button 
              className={`tab-btn ${activeTab === 'till' ? 'active' : ''}`}
              onClick={() => setActiveTab('till')}
            >
              Till
            </button>
          </div>
        </div>
      </div>
      
      {activeTab === 'scanner' ? (
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
                  disabled={false}
                />
                <button 
                  onClick={handleScan}
                  className="scan-btn"
                  disabled={false}
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
                      <td>
                        {item.discount ? (
                          <div className="price-with-discount">
                            <span className="original-price">{formatCurrency(item.price)}</span>
                            <span className="discounted-price">{formatCurrency(item.price - item.discount)}</span>
                          </div>
                        ) : (
                          formatCurrency(item.price)
                        )}
                      </td>
                      <td className="total-cell">
                        {formatCurrency((item.price - (item.discount || 0)) * item.quantity)}
                      </td>
                      <td>
                        <div className="item-actions">
                          {item.discount ? (
                            <button 
                              onClick={() => removeDiscount(index)}
                              className="discount-btn has-discount"
                              title={`Remove $${item.discount.toFixed(2)} discount`}
                            >
                              -${item.discount.toFixed(2)}
                            </button>
                          ) : (
                            <button 
                              onClick={() => openDiscountModal(index)}
                              className="discount-btn"
                            >
                              Discount
                            </button>
                          )}
                          <button 
                            onClick={() => removeFromCart(index)}
                            className="remove-btn"
                          >
                            ×
                          </button>
                        </div>
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
      ) : (
        <div className="till-tab-content">
          <TillDashboard />
        </div>
      )}

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
                    
                    {/* Quick Cash Buttons */}
                    <div className="quick-cash-section">
                      <label>Quick Cash:</label>
                      <div className="quick-cash-buttons">
                        {(() => {
                          const amount = Math.ceil(totals.total);
                          const buttons = [];
                          
                          // Next highest $10
                          if (amount <= 10) {
                            buttons.push(10);
                          } else {
                            const next10 = Math.ceil(amount / 10) * 10;
                            if (next10 > amount) buttons.push(next10);
                          }
                          
                          // Next highest $20
                          const next20 = Math.ceil(amount / 20) * 20;
                          if (next20 > amount && !buttons.includes(next20)) buttons.push(next20);
                          
                          // Add $50 if amount is less than 50
                          if (amount < 50) buttons.push(50);
                          
                          // Add $100
                          if (amount < 100) buttons.push(100);
                          
                          return buttons.map(value => (
                            <button
                              key={value}
                              className="quick-cash-btn"
                              onClick={() => {
                                setAmountTendered(value.toString());
                                setIsQuickCash(true);
                              }}
                            >
                              ${value}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Amount Tendered Display */}
                    <div className="payment-display-row">
                      <div className="payment-display-box tendered-box full-width">
                        <label>Amount Tendered</label>
                        <span className="amount-value">
                          {formatCurrency(parseFloat(amountTendered) || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Number Keypad */}
                    <div className="cash-keypad">
                      <div className="keypad-row">
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('7');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '7');
                          }
                        }}>7</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('8');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '8');
                          }
                        }}>8</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('9');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '9');
                          }
                        }}>9</button>
                      </div>
                      <div className="keypad-row">
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('4');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '4');
                          }
                        }}>4</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('5');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '5');
                          }
                        }}>5</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('6');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '6');
                          }
                        }}>6</button>
                      </div>
                      <div className="keypad-row">
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('1');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '1');
                          }
                        }}>1</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('2');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '2');
                          }
                        }}>2</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('3');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '3');
                          }
                        }}>3</button>
                      </div>
                      <div className="keypad-row">
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('0');
                            setIsQuickCash(false);
                          } else {
                            setAmountTendered(prev => prev + '0');
                          }
                        }}>0</button>
                        <button className="keypad-btn" onClick={() => {
                          if (isQuickCash) {
                            setAmountTendered('');
                            setIsQuickCash(false);
                          }
                          setAmountTendered(prev => prev.includes('.') ? prev : prev + '.');
                        }}>.</button>
                        <button className="keypad-btn clear" onClick={() => {
                          setAmountTendered('');
                          setIsQuickCash(false);
                        }}>C</button>
                      </div>
                    </div>

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

      {/* Discount Modal */}
      {showDiscountModal && discountItemIndex !== null && (
        <div className="modal-overlay">
          <div className="discount-modal">
            <div className="modal-header">
              <h3>Apply Discount</h3>
              <button 
                onClick={() => {
                  setShowDiscountModal(false);
                  setDiscountAmount("");
                  setDiscountItemIndex(null);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="discount-item-info">
                <p>{cart[discountItemIndex].description}</p>
                <p className="item-price">Price: {formatCurrency(cart[discountItemIndex].price)}</p>
              </div>
              
              <div className="percentage-buttons">
                <button onClick={() => applyPercentageDiscount(5)} className="percent-btn">5%</button>
                <button onClick={() => applyPercentageDiscount(10)} className="percent-btn">10%</button>
                <button onClick={() => applyPercentageDiscount(15)} className="percent-btn">15%</button>
                <button onClick={() => applyPercentageDiscount(20)} className="percent-btn">20%</button>
                <button onClick={() => applyPercentageDiscount(25)} className="percent-btn">25%</button>
                <button onClick={() => applyPercentageDiscount(50)} className="percent-btn">50%</button>
              </div>
              
              <div className="discount-input-group">
                <label>Discount Amount ($)</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={cart[discountItemIndex].price}
                  className="discount-input"
                />
              </div>
              
              <div className="modal-buttons">
                <button 
                  onClick={applyDiscount} 
                  className="apply-btn"
                  disabled={!discountAmount || parseFloat(discountAmount) <= 0}
                >
                  Apply Discount
                </button>
                <button 
                  onClick={() => {
                    setShowDiscountModal(false);
                    setDiscountAmount("");
                    setDiscountItemIndex(null);
                  }} 
                  className="cancel-btn"
                >
                  Cancel
                </button>
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