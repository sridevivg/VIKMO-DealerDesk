import React, { useState } from "react";
import { Package, ShoppingCart, Bot, TrendingUp, Layers, Activity } from "lucide-react";
import CatalogueView from "./components/CatalogueView.jsx";
import OrderManager from "./components/OrderManager.jsx";
import AssistantChat from "./components/AssistantChat.jsx";
import ReorderDashboard from "./components/ReorderDashboard.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("catalogue");
  const [cart, setCart] = useState([]);

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.sku === product.sku);
      if (existing) {
        return prev.map((item) =>
          item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateQty = (sku, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(sku);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.sku === sku ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (sku) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <header
        style={{
          background: "rgba(17, 24, 39, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-color)",
          padding: "0.85rem 1.5rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(59, 130, 246, 0.4)",
              }}
            >
              <Layers size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.15rem", fontWeight: "800", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                VIKMO <span style={{ color: "var(--accent-primary)" }}>DealerDesk</span>
              </h1>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginTop: "-2px" }}>
                AI-Native Commerce OS · Bengaluru Hub
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveTab("catalogue")}
              className={activeTab === "catalogue" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.5rem 1rem", fontSize: "0.88rem" }}
            >
              <Package size={16} /> Catalogue & Stock
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={activeTab === "orders" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.5rem 1rem", fontSize: "0.88rem", position: "relative" }}
            >
              <ShoppingCart size={16} /> Orders & Cart
              {totalCartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-5px",
                    right: "-5px",
                    background: "var(--danger)",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {totalCartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={activeTab === "assistant" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.5rem 1rem", fontSize: "0.88rem" }}
            >
              <Bot size={16} /> Dealer Assistant
            </button>
            <button
              onClick={() => setActiveTab("reorders")}
              className={activeTab === "reorders" ? "btn-primary" : "btn-secondary"}
              style={{ padding: "0.5rem 1rem", fontSize: "0.88rem" }}
            >
              <TrendingUp size={16} /> Reorders & ML
            </button>
          </nav>

          {/* Live System Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <Activity size={14} color="var(--success)" />
            <span>API Online :8000</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem", width: "100%", flex: 1 }}>
        {activeTab === "catalogue" && <CatalogueView onAddToCart={handleAddToCart} />}
        {activeTab === "orders" && (
          <OrderManager
            cart={cart}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
          />
        )}
        {activeTab === "assistant" && <AssistantChat />}
        {activeTab === "reorders" && <ReorderDashboard />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-color)", padding: "1rem 1.5rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        VIKMO DealerDesk — PostgreSQL Concurrency Safe · 18% GST Paisa Precision · Prompt Injection Hardened · Leakage-Free Forecasts
      </footer>
    </div>
  );
}
