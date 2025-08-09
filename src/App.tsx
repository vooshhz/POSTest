import { useState } from "react";

export default function App() {
  const [sku, setSku] = useState("DEMO-123");
  const [name, setName] = useState("Demo Item");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  async function add() {
    const res = await window.api.addToInventory(sku, name, qty);
    setMsg(`Added. On hand for ${sku}: ${res.onHand}`);
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <h2>POS Lite</h2>
      <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value || "0"))} placeholder="Qty" />
      <button onClick={add}>Add to inventory</button>
      <div style={{ marginTop: 8 }}>{msg}</div>
    </div>
  );
}
