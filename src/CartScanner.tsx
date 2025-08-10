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

export default function CartScanner() {
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        setError(result.error || "Item not found in inventory");
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
    return cart.reduce((totals, item) => ({
      totalItems: totals.totalItems + item.quantity,
      totalCost: totals.totalCost + (item.cost * item.quantity),
      totalPrice: totals.totalPrice + (item.price * item.quantity)
    }), { totalItems: 0, totalCost: 0, totalPrice: 0 });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
                    <th>Description</th>
                    <th>Volume</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => (
                    <tr key={index}>
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
              <div className="summary-row">
                <span>Total Items:</span>
                <span>{totals.totalItems}</span>
              </div>
              <div className="summary-row">
                <span>Total Cost:</span>
                <span>{formatCurrency(totals.totalCost)}</span>
              </div>
              <div className="summary-row total">
                <span>Total Price:</span>
                <span>{formatCurrency(totals.totalPrice)}</span>
              </div>
              <button className="checkout-btn">
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}