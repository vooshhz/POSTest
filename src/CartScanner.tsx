import { api } from './api/apiLayer';
import { useState, useRef, useEffect } from "react";
import "./CartScanner.css";
import TransactionCompleteModal from "./TransactionCompleteModal";
import TillDashboard from "./TillDashboard";
import Payout from "./Payout";

interface CartItem {
  upc: string;
  description: string | null;
  volume: string | null;
  quantity: number;
  cost: number;
  price: number;
  discount?: number;
  taxable?: boolean;
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
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutInitialType, setPayoutInitialType] = useState<'lottery' | 'bottle' | 'other' | undefined>(undefined);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualEntryTaxable, setManualEntryTaxable] = useState(true);
  const [manualEntryAmount, setManualEntryAmount] = useState("");
  const [manualEntryType, setManualEntryType] = useState<'manual' | 'lottery'>('manual');
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
    creditTotal?: number;
    total: number;
    paymentType: 'cash' | 'debit' | 'credit';
    cashGiven?: number;
    changeGiven?: number;
    timestamp: string;
  } | undefined>(undefined);
  const [transactionError, setTransactionError] = useState("");
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
      if (inputRef.current && activeTab === 'scanner') {
        inputRef.current.focus();
        inputRef.current.click(); // Try clicking too
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Keep input focused when clicking anywhere in the scanner area
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (activeTab === 'scanner' && !showPayoutModal && !showManualEntryModal && !showAddModal && !showDiscountModal) {
        // Check if click is not on an input, button, or modal
        const target = e.target as HTMLElement;
        if (!target.closest('input') && !target.closest('button') && !target.closest('.modal-overlay')) {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [activeTab, showPayoutModal, showManualEntryModal, showAddModal, showDiscountModal]);

  // Periodically check and refocus if needed
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'scanner' && 
          !showPayoutModal && 
          !showManualEntryModal && 
          !showAddModal && 
          !showDiscountModal && 
          !showTransactionComplete &&
          document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [activeTab, showPayoutModal, showManualEntryModal, showAddModal, showDiscountModal, showTransactionComplete]);

  // Handle keyboard input for manual entry modal
  useEffect(() => {
    if (!showManualEntryModal) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Handle number keys
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setManualEntryAmount(prev => prev + e.key);
      }
      // Handle decimal point
      else if (e.key === '.' && !manualEntryAmount.includes('.')) {
        e.preventDefault();
        setManualEntryAmount(prev => prev + '.');
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        setManualEntryAmount(prev => prev.slice(0, -1));
      }
      // Handle clear (Delete or c)
      else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setManualEntryAmount('');
      }
      // Handle Enter for add to cart
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (manualEntryAmount && parseFloat(manualEntryAmount) > 0) {
          handleManualEntry();
        }
      }
      // Handle Escape for cancel
      else if (e.key === 'Escape') {
        e.preventDefault();
        setShowManualEntryModal(false);
        setManualEntryType('manual');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showManualEntryModal, manualEntryAmount, manualEntryType]);

  // Handle keyboard input for cash payment modal
  useEffect(() => {
    if (!showPaymentModal || paymentMethod !== 'cash') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Handle number keys
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (isQuickCash) {
          setAmountTendered(e.key);
          setIsQuickCash(false);
        } else {
          setAmountTendered(prev => prev + e.key);
        }
      }
      // Handle decimal point
      else if (e.key === '.' && !amountTendered.includes('.')) {
        e.preventDefault();
        if (isQuickCash) {
          setAmountTendered('0.');
          setIsQuickCash(false);
        } else {
          setAmountTendered(prev => prev + '.');
        }
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        if (isQuickCash) {
          setAmountTendered('');
          setIsQuickCash(false);
        } else {
          setAmountTendered(prev => prev.slice(0, -1));
        }
      }
      // Handle clear (Delete or c)
      else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setAmountTendered('');
        setIsQuickCash(false);
      }
      // Handle Enter for complete sale
      else if (e.key === 'Enter') {
        e.preventDefault();
        const totals = calculateTotals();
        if (totals.total <= 0 || (amountTendered && parseFloat(amountTendered) >= totals.total)) {
          processPayment();
        }
      }
      // Handle Escape for back
      else if (e.key === 'Escape') {
        e.preventDefault();
        setPaymentMethod(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showPaymentModal, paymentMethod, amountTendered, isQuickCash]);

  // Handle keyboard input for discount modal
  useEffect(() => {
    if (!showDiscountModal || discountItemIndex === null) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Handle number keys
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setDiscountAmount(prev => prev + e.key);
      }
      // Handle decimal point
      else if (e.key === '.' && !discountAmount.includes('.')) {
        e.preventDefault();
        setDiscountAmount(prev => prev + '.');
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        setDiscountAmount(prev => prev.slice(0, -1));
      }
      // Handle clear (Delete or c)
      else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setDiscountAmount('');
      }
      // Handle Enter for apply discount
      else if (e.key === 'Enter') {
        e.preventDefault();
        const discountValue = parseFloat(discountAmount);
        if (!isNaN(discountValue) && discountValue > 0) {
          const updatedCart = [...cart];
          updatedCart[discountItemIndex] = { 
            ...cart[discountItemIndex], 
            discount: discountValue 
          };
          setCart(updatedCart);
          setShowDiscountModal(false);
          setDiscountItemIndex(null);
          setDiscountAmount("");
          // Refocus input after discount
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
      // Handle Escape for cancel
      else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDiscountModal(false);
        setDiscountAmount("");
        setDiscountItemIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDiscountModal, discountItemIndex, discountAmount, cart]);

  // Search inventory when input changes
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (barcode.length > 2 && isNaN(Number(barcode))) {
        // It's text, not a UPC
        try {
          const result = await api.searchInventoryByDescription(barcode);
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
    // Refocus with delay to ensure modal is closed
    setTimeout(() => inputRef.current?.focus(), 100);
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

    const code = barcode.trim();
    
    // Check for shortcut codes
    if (code === "1000") {
      // Non-Tax manual entry
      setManualEntryType('manual');
      setManualEntryTaxable(false);
      setShowManualEntryModal(true);
      setManualEntryAmount("");
      setBarcode("");
      return;
    } else if (code === "2000") {
      // Tax manual entry
      setManualEntryType('manual');
      setManualEntryTaxable(true);
      setShowManualEntryModal(true);
      setManualEntryAmount("");
      setBarcode("");
      return;
    } else if (code === "5000") {
      // Lottery (taxable manual entry with description)
      setManualEntryType('lottery');
      setManualEntryTaxable(true);
      setShowManualEntryModal(true);
      setManualEntryAmount("");
      setBarcode("");
      return;
    } else if (code === "5001") {
      // Lottery Payout
      setPayoutInitialType('lottery');
      setShowPayoutModal(true);
      setBarcode("");
      return;
    } else if (code === "10000") {
      // Bottle Deposit Payout
      setPayoutInitialType('bottle');
      setShowPayoutModal(true);
      setBarcode("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if item exists in inventory
      const result = await api.checkInventory(code);
      
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
            price: result.data.price,
            taxable: result.data.taxable !== undefined ? result.data.taxable : true // Default to taxable
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
      // Refocus input after updating quantity
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    // Refocus input after removing item
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const clearCart = () => {
    setCart([]);
    setBarcode("");
    inputRef.current?.focus();
  };

  const calculateTotals = () => {
    // Separate debit items (positive price) from credit items (negative price)
    let debitSubtotal = 0;
    let taxableSubtotal = 0;
    let creditTotal = 0;
    let totalItems = 0;
    let totalDiscount = 0;
    
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      const discount = (item.discount || 0) * item.quantity;
      const itemNetPrice = itemTotal - discount;
      
      if (item.price >= 0) {
        // Debit items (regular products) - apply discounts
        debitSubtotal += itemNetPrice;
        totalDiscount += discount;
        
        // Only add to taxable subtotal if item is taxable
        if (item.taxable !== false) { // Default to taxable if undefined
          taxableSubtotal += itemNetPrice;
        }
      } else {
        // Credit items (payouts, returns) - no discounts, no tax
        creditTotal += itemTotal; // This will be negative
      }
      
      totalItems += item.quantity;
    });
    
    // Tax only applies to taxable items
    const tax = taxableSubtotal * 0.06; // Michigan 6% sales tax
    
    // Calculate final total: debit subtotal + tax - credits
    const subtotal = debitSubtotal; // Subtotal before credits
    const total = debitSubtotal + tax + creditTotal; // Credits applied AFTER tax
    
    return {
      totalItems,
      subtotal,
      taxableSubtotal,
      tax,
      creditTotal, // Return credit total separately
      total,
      totalDiscount
    };
  };

  const toggleTaxable = async (index: number) => {
    const item = cart[index];
    // Don't toggle for payout, manual entry, or lottery items
    if (!item.upc.startsWith('PAYOUT_') && !item.upc.startsWith('MANUAL_') && !item.upc.startsWith('LOTTERY_')) {
      const newTaxableStatus = item.taxable === false ? true : false;
      
      // Update in database if it's a real inventory item
      const result = await api.updateItemTaxable(item.upc, newTaxableStatus);
      
      if (result.success) {
        // Update cart
        const updatedCart = [...cart];
        updatedCart[index].taxable = newTaxableStatus;
        setCart(updatedCart);
      } else {
        setError(`Failed to update taxable status: ${result.error}`);
      }
    }
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
    // When total is negative (money owed to customer), skip payment validation
    if (totals.total > 0 && paymentMethod === 'cash') {
      const tendered = parseFloat(amountTendered);
      if (isNaN(tendered) || tendered < totals.total) {
        alert("Insufficient payment amount");
        return;
      }
    }

    // Save transaction to database
    try {
      // If total is negative (refund/payout), cash given is 0 and change is the absolute value
      let cashGiven: number | undefined;
      let changeGiven: number | undefined;
      
      if (totals.total <= 0) {
        // Customer is owed money
        cashGiven = 0;
        changeGiven = Math.abs(totals.total); // Amount owed to customer
      } else if (paymentMethod === 'cash') {
        // Customer owes money and paying cash
        cashGiven = parseFloat(amountTendered);
        changeGiven = cashGiven ? Math.max(0, cashGiven - totals.total) : undefined;
      } else {
        // Card payment
        cashGiven = undefined;
        changeGiven = undefined;
      }
      
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
      
      const result = await api.saveTransaction(transaction);
      
      if (result.success) {
        // Simulate payment processing
        setTimeout(() => {
          // Prepare transaction data for receipt
          const transactionComplete = {
            items: itemsData,
            subtotal: totals.subtotal,
            tax: totals.tax,
            creditTotal: totals.creditTotal < 0 ? totals.creditTotal : undefined,
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
      const result = await api.addToInventory({
        upc: scannedUpc,
        cost,
        price,
        quantity
      });

      if (result.success) {
        // After successfully adding to inventory, try to add to cart
        const checkResult = await api.checkInventory(scannedUpc);
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


  const openDiscountModal = (index: number) => {
    // Don't allow discounts on credit/payout items
    if (cart[index].price < 0) return;
    
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
    // Refocus input after removing discount
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handlePayoutComplete = (type: string, amount: number, description?: string) => {
    // Generate proper UPC based on payout type
    let upcPrefix = 'PAYOUT_';
    if (type.includes('Lottery')) {
      upcPrefix = 'PAYOUT_LOTTERY_';
    } else if (type.includes('Bottle') || type.includes('Can')) {
      upcPrefix = 'PAYOUT_BOTTLE_';
    } else {
      upcPrefix = 'PAYOUT_OTHER_';
    }
    
    // Add payout as a credit (negative price) to the cart
    const payoutItem: CartItem = {
      upc: `${upcPrefix}${Date.now()}`, // Unique ID for payout with type prefix
      description: type,
      volume: description || null,
      quantity: 1,
      cost: 0,
      price: -amount // Negative amount for credit
    };
    
    setCart([...cart, payoutItem]);
    setShowPayoutModal(false);
    setPayoutInitialType(undefined);
    setError("");
    // Refocus the input after payout
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleManualEntry = () => {
    const amount = parseFloat(manualEntryAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    // Add manual entry item to cart
    let manualItem: CartItem;
    
    if (manualEntryType === 'lottery') {
      manualItem = {
        upc: `LOTTERY_${Date.now()}`,
        description: "Lottery Ticket",
        volume: null,
        quantity: 1,
        cost: 0,
        price: amount,
        taxable: true // Lottery is always taxable
      };
    } else {
      manualItem = {
        upc: `MANUAL_${manualEntryTaxable ? 'TAX' : 'NONTAX'}_${Date.now()}`,
        description: manualEntryTaxable ? "Manual Entry (Taxable)" : "Manual Entry (Non-Taxable)",
        volume: null,
        quantity: 1,
        cost: 0,
        price: amount,
        taxable: manualEntryTaxable
      };
    }

    setCart([...cart, manualItem]);
    setShowManualEntryModal(false);
    setManualEntryAmount("");
    setManualEntryType('manual'); // Reset type
    setError("");
    // Refocus the input after manual entry
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handlePopulate = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Get current inventory with stock levels
      const inventoryResult = await api.getInventory();
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
              <div className="scanner-controls-row">
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
            <div className="cart-content">
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
                <div className="cart-items-wrapper">
                  <div className="cart-items">
                    <table className="cart-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Taxable</th>
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
                      <td className="taxable-cell">
                        {/* Handle different item types */}
                        {item.price < 0 ? (
                          <span>-</span>
                        ) : item.upc.startsWith('MANUAL_') || item.upc.startsWith('LOTTERY_') ? (
                          <span>{item.taxable ? '✓' : '✗'}</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={item.taxable !== false}
                            onChange={() => toggleTaxable(index)}
                            className="taxable-checkbox"
                          />
                        )}
                      </td>
                      <td>
                        {/* Credit/payout items have fixed quantity of 1 */}
                        {item.price < 0 ? (
                          <div className="quantity-fixed">1</div>
                        ) : (
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
                        )}
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
                          {/* No discount for credit/payout items */}
                          {item.price >= 0 && (
                            item.discount ? (
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
                            )
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
          </div>
        )}
      </div>
      
      {/* Cart Bottom Actions - Always visible */}
      <div className="cart-bottom-actions">
        <button className="void-cart-btn" onClick={voidCart}>
          Void
        </button>
        <button className="checkout-btn" onClick={handleCheckout}>
          Checkout
        </button>
      </div>
    </div>
  </div>

        {/* Right Section - Action Buttons and Summary */}
        <div className="manual-entry-panel">
          <div className="action-buttons-vertical">
            <button 
              className="action-btn payout-btn" 
              onClick={() => {
                setPayoutInitialType(undefined);
                setShowPayoutModal(true);
              }}
            >
              💰 Payout
            </button>
            <button 
              className="action-btn lottery-btn" 
              onClick={() => {
                setManualEntryType('lottery');
                setManualEntryTaxable(true);
                setShowManualEntryModal(true);
                setManualEntryAmount("");
              }}
            >
              🎰 Lottery
            </button>
            <button 
              className="action-btn tax-btn" 
              onClick={() => {
                setManualEntryType('manual');
                setManualEntryTaxable(true);
                setShowManualEntryModal(true);
                setManualEntryAmount("");
              }}
            >
              💵 Tax
            </button>
            <button 
              className="action-btn nontax-btn" 
              onClick={() => {
                setManualEntryType('manual');
                setManualEntryTaxable(false);
                setShowManualEntryModal(true);
                setManualEntryAmount("");
              }}
            >
              💴 Non-Tax
            </button>
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
              {totals.creditTotal < 0 && (
                <div className="summary-row" style={{ color: '#dc3545' }}>
                  <span>Credits:</span>
                  <span>{formatCurrency(totals.creditTotal)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
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
                      <strong>{totals.total <= 0 ? 'Amount Owed to Customer:' : 'Amount Due:'}</strong> {formatCurrency(Math.abs(totals.total))}
                    </div>
                    
                    {totals.total > 0 ? (
                    <>
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
                    </>
                    ) : (
                      <div className="refund-notice" style={{ padding: '20px', textAlign: 'center' }}>
                        <p style={{ fontSize: '18px', marginBottom: '10px' }}>No payment required.</p>
                        <p style={{ fontSize: '20px', fontWeight: 'bold' }}>Amount to give customer: {formatCurrency(Math.abs(totals.total))}</p>
                      </div>
                    )}

                    <div className="modal-buttons">
                      <button 
                        onClick={processPayment} 
                        className="complete-sale-btn"
                        disabled={totals.total > 0 && (!amountTendered || parseFloat(amountTendered) < totals.total)}
                      >
                        {totals.total <= 0 ? 'Complete Transaction' : 'Complete Sale'}
                      </button>
                      <button onClick={() => setPaymentMethod(null)} className="back-btn">
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card-payment">
                    <div className="amount-due">
                      <strong>{totals.total <= 0 ? 'Amount Owed to Customer:' : 'Amount Due:'}</strong> {formatCurrency(Math.abs(totals.total))}
                    </div>
                    {totals.total > 0 ? (
                      <div className="processing">
                        <div className="spinner"></div>
                        <p>Processing {paymentMethod} card payment...</p>
                      </div>
                    ) : (
                      <div className="refund-notice" style={{ padding: '20px', textAlign: 'center' }}>
                        <p style={{ fontSize: '18px' }}>Processing credit to {paymentMethod} card...</p>
                      </div>
                    )}
                    <div className="modal-buttons">
                      <button 
                        onClick={processPayment} 
                        className="complete-sale-btn"
                      >
                        {totals.total <= 0 ? 'Complete Transaction' : 'Process Payment'}
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

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="modal-overlay">
          <div className="payout-modal">
            <Payout 
              onComplete={handlePayoutComplete}
              onCancel={() => {
                setShowPayoutModal(false);
                setPayoutInitialType(undefined);
              }}
              initialType={payoutInitialType}
            />
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntryModal && (
        <div className="modal-overlay" onClick={() => setShowManualEntryModal(false)}>
          <div className="modal-content manual-entry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{
                manualEntryType === 'lottery' 
                  ? "Lottery Ticket" 
                  : manualEntryTaxable 
                    ? "Manual Entry (Taxable)" 
                    : "Manual Entry (Non-Taxable)"
              }</h3>
              <button className="modal-close-btn" onClick={() => {
                setShowManualEntryModal(false);
                setManualEntryType('manual'); // Reset type on close
              }}>×</button>
            </div>
            
            <div className="manual-entry-content">
              <div className="amount-display">
                <label>Enter Amount:</label>
                <div className="amount-value">
                  ${manualEntryAmount || "0.00"}
                </div>
              </div>

              {/* Number Keypad */}
              <div className="manual-keypad">
                <div className="keypad-row">
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '7')}>7</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '8')}>8</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '9')}>9</button>
                </div>
                <div className="keypad-row">
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '4')}>4</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '5')}>5</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '6')}>6</button>
                </div>
                <div className="keypad-row">
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '1')}>1</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '2')}>2</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '3')}>3</button>
                </div>
                <div className="keypad-row">
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev + '0')}>0</button>
                  <button className="keypad-btn" onClick={() => setManualEntryAmount(prev => prev.includes('.') ? prev : prev + '.')}>.</button>
                  <button className="keypad-btn clear" onClick={() => setManualEntryAmount('')}>C</button>
                </div>
              </div>

              <div className="modal-buttons">
                <button 
                  onClick={handleManualEntry} 
                  className="add-to-cart-btn"
                  disabled={!manualEntryAmount || parseFloat(manualEntryAmount) <= 0}
                >
                  Add to Cart
                </button>
                <button onClick={() => {
                  setShowManualEntryModal(false);
                  setManualEntryType('manual'); // Reset type
                }} className="cancel-btn">
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