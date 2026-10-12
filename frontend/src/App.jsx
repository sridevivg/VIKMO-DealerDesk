import React, { useState } from "react";
import { Package, ShoppingCart, MessageSquare, TrendingUp, Layers } from "lucide-react";
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>
      {/* Compact Professional Header */}
      <header
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-light)",
          padding: "0.75rem 1.5rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1360px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {/* Product Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-charcoal)",
                color: "var(--text-inverse)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={16} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1rem",
                  fontWeight: "700",
                  letterSpacing: "-0.01em",
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                VIKMO DealerDesk
              </h1>
            </div>
          </div>

          {/* Simple Navigation */}
          <nav style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              onClick={() => setActiveTab("catalogue")}
              className={`nav-btn ${activeTab === "catalogue" ? "active" : ""}`}
            >
              <Package size={15} /> Catalogue & Stock
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`nav-btn ${activeTab === "orders" ? "active" : ""}`}
            >
              <ShoppingCart size={15} /> Orders & Cart
              {totalCartCount > 0 && (
                <span
                  style={{
                    marginLeft: "0.25rem",
                    padding: "0.1rem 0.45rem",
                    borderRadius: "999px",
                    fontSize: "0.7rem",
                    fontWeight: "600",
                    background: activeTab === "orders" ? "var(--bg-surface)" : "var(--bg-charcoal)",
                    color: activeTab === "orders" ? "var(--text-primary)" : "var(--text-inverse)",
                  }}
                >
                  {totalCartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={`nav-btn ${activeTab === "assistant" ? "active" : ""}`}
            >
              <MessageSquare size={15} /> Dealer Support
            </button>
            <button
              onClick={() => setActiveTab("reorders")}
              className={`nav-btn ${activeTab === "reorders" ? "active" : ""}`}
            >
              <TrendingUp size={15} /> Reorders & Forecasts
            </button>
          </nav>

          {/* System Connection Indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#16a34a",
                display: "inline-block",
              }}
            />
            <span>API Online :8000</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ maxWidth: "1360px", margin: "0 auto", padding: "1.5rem", width: "100%", flex: 1 }}>
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

      {/* Clean Commercial Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-light)",
          background: "var(--bg-surface)",
          padding: "0.85rem 1.5rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        VIKMO DealerDesk · Inventory and Order Operations Desk · Central Hub Bengaluru
      </footer>
    </div>
  );
}
