import { useState } from "react";
import { BarcodeGenerator } from "./renderer/components/BarcodeGenerator";
import { BarcodeScanner } from "./renderer/components/BarcodeScanner";
import { ProductView } from "./renderer/components/ProductView";
import type { ProductData } from "./global";

type TabType = 'home' | 'view';

export default function App() {
  const [sku, setSku] = useState("DEMO-123");
  const [name, setName] = useState("Demo Item");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [foundProduct, setFoundProduct] = useState<ProductData | null>(null);
  const [searchedUPC, setSearchedUPC] = useState<string>('');

  async function add() {
    const res = await window.api.addToInventory(sku, name, qty);
    setMsg(`Added. On hand for ${sku}: ${res.onHand}`);
  }

  const handleScannerSearch = (product: ProductData | null, searchedUPC: string) => {
    console.log('App: handleScannerSearch called with product:', product, 'UPC:', searchedUPC);
    setFoundProduct(product);
    setSearchedUPC(searchedUPC);
    setActiveTab('view');
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>POS Lite</h1>
        <nav className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button 
            className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            View
          </button>
        </nav>
      </div>

      <div className="app-content">
        {activeTab === 'home' && (
          <div className="home-tab">
            <div className="inventory-section">
              <h3>Inventory Management</h3>
              <div className="form-group">
                <input 
                  value={sku} 
                  onChange={(e) => setSku(e.target.value)} 
                  placeholder="SKU" 
                  className="form-input"
                />
                <input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Name" 
                  className="form-input"
                />
                <input 
                  type="number" 
                  value={qty} 
                  onChange={(e) => setQty(parseInt(e.target.value || "0"))} 
                  placeholder="Qty" 
                  className="form-input"
                />
                <button onClick={add} className="btn btn-primary">
                  Add to inventory
                </button>
                <button 
                  onClick={() => setShowBarcodeModal(true)} 
                  className="btn btn-secondary"
                >
                  Barcode Generator
                </button>
              </div>
              {msg && <div className="status-message">{msg}</div>}
            </div>

            <div className="scanner-section">
              <BarcodeScanner onProductFound={handleScannerSearch} />
            </div>
          </div>
        )}

        {activeTab === 'view' && (
          <div className="view-tab">
            <ProductView product={foundProduct} searchedUPC={searchedUPC} />
          </div>
        )}
      </div>
      
      <BarcodeGenerator 
        isOpen={showBarcodeModal} 
        onClose={() => setShowBarcodeModal(false)} 
      />
    </div>
  );
}