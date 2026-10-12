import React, { useState, useEffect } from "react";
import { Check, X, Truck, Package, AlertTriangle, AlertCircle, RefreshCw, ShoppingCart, ChevronRight } from "lucide-react";

export default function OrderManager({ cart, onUpdateQty, onRemoveItem, onClearCart }) {
  const [dealers, setDealers] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(1);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("cart"); // 'cart' or 'orders'
  const [statusFilter, setStatusFilter] = useState("");
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  const fetchDealers = async () => {
    try {
      const res = await fetch("/api/dealers/?page_size=50");
      if (res.ok) {
        const data = await res.json();
        setDealers(data.results || []);
        if (data.results?.length > 0 && !selectedDealer) {
          setSelectedDealer(data.results[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch dealers:", err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/orders/?status=${statusFilter}` : "/api/orders/";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
    fetchOrders();
  }, [statusFilter]);

  const handleCreateDraft = async () => {
    setErrorBanner(null);
    setSuccessBanner(null);

    if (cart.length === 0) {
      setErrorBanner("Your cart is empty. Please add products from the catalogue.");
      return;
    }

    const payload = {
      dealer_id: parseInt(selectedDealer, 10),
      items: cart.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
      })),
    };

    try {
      const res = await fetch("/api/orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessBanner(`DRAFT order created: ${data.order_number}`);
        onClearCart();
        fetchOrders();
        setActiveTab("orders");
      } else {
        setErrorBanner(data?.error?.message || "Failed to create draft order.");
      }
    } catch (err) {
      setErrorBanner("Network error creating draft order.");
    }
  };

  const handleAction = async (orderNumber, action) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await fetch(`/api/orders/${orderNumber}/${action}/`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessBanner(`Order ${orderNumber} is now ${data.status}`);
        fetchOrders();
      } else {
        const error = data?.error;
        let msg = error?.message || `Failed to ${action} order.`;
        if (error?.details && error.details.length > 0) {
          msg += " Short SKUs: " + error.details.map((d) => `${d.sku} (req: ${d.requested}, avail: ${d.available})`).join(", ");
        }
        setErrorBanner(msg);
      }
    } catch (err) {
      setErrorBanner(`Network error trying to ${action} order.`);
    }
  };

  // Cart summary calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
  const cartTax = cartSubtotal * 0.18;
  const cartGrandTotal = cartSubtotal + cartTax;

  return (
    <div className="animate-fade">
      {/* Navigation tabs between Cart and Orders */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => setActiveTab("cart")}
          className={activeTab === "cart" ? "btn-primary" : "btn-secondary"}
        >
          <ShoppingCart size={16} /> New Order Cart ({cart.length})
        </button>
        <button
          onClick={() => { setActiveTab("orders"); fetchOrders(); }}
          className={activeTab === "orders" ? "btn-primary" : "btn-secondary"}
        >
          <Package size={16} /> Orders History ({orders.length})
        </button>
      </div>

      {/* Notifications */}
      {errorBanner && (
        <div style={{
          marginBottom: "1.5rem", padding: "1rem", borderRadius: "8px",
          background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.3)",
          display: "flex", alignItems: "center", gap: "0.5rem"
        }}>
          <AlertCircle size={20} />
          <strong>Error:</strong> {errorBanner}
        </div>
      )}

      {successBanner && (
        <div style={{
          marginBottom: "1.5rem", padding: "1rem", borderRadius: "8px",
          background: "var(--success-bg)", color: "var(--success)", border: "1px solid rgba(16, 185, 129, 0.3)",
          display: "flex", alignItems: "center", gap: "0.5rem"
        }}>
          <Check size={20} />
          {successBanner}
        </div>
      )}

      {activeTab === "cart" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
          {/* Cart Table */}
          <div className="card">
            <h2 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "1rem" }}>
              Cart Line Items
            </h2>

            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                <ShoppingCart size={40} style={{ margin: "0 auto 0.5rem auto", opacity: 0.4 }} />
                Your cart is currently empty. Browse the catalogue to add parts.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "0.6rem" }}>SKU</th>
                    <th style={{ padding: "0.6rem" }}>Part Name</th>
                    <th style={{ padding: "0.6rem" }}>Unit Price</th>
                    <th style={{ padding: "0.6rem" }}>Quantity</th>
                    <th style={{ padding: "0.6rem", textAlign: "right" }}>Subtotal</th>
                    <th style={{ padding: "0.6rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const lineSub = (parseFloat(item.price) * item.quantity).toFixed(2);
                    return (
                      <tr key={item.sku} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                        <td style={{ padding: "0.6rem", fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>{item.sku}</td>
                        <td style={{ padding: "0.6rem", fontWeight: "600" }}>{item.name}</td>
                        <td style={{ padding: "0.6rem" }}>₹{item.price}</td>
                        <td style={{ padding: "0.6rem" }}>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => onUpdateQty(item.sku, parseInt(e.target.value, 10) || 1)}
                            className="input-field"
                            style={{ width: "65px", padding: "0.3rem 0.5rem" }}
                          />
                        </td>
                        <td style={{ padding: "0.6rem", textAlign: "right", fontWeight: "700" }}>₹{lineSub}</td>
                        <td style={{ padding: "0.6rem", textAlign: "right" }}>
                          <button onClick={() => onRemoveItem(item.sku)} style={{ color: "var(--danger)" }}>
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Checkout Panel */}
          <div className="card" style={{ height: "fit-content" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem" }}>
              Order Checkout
            </h3>

            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                Select Ordering Dealer:
              </label>
              <select
                value={selectedDealer}
                onChange={(e) => setSelectedDealer(e.target.value)}
                className="input-field"
                style={{ width: "100%" }}
              >
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dealer_code} — {d.name} ({d.city})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1rem", marginBottom: "1.2rem", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>Line Subtotal:</span>
                <span>₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>GST (18% rounded):</span>
                <span>₹{cartTax.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)", borderTop: "1px solid var(--border-color)", paddingTop: "0.5rem" }}>
                <span>Grand Total:</span>
                <span>₹{cartGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCreateDraft}
              disabled={cart.length === 0}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Create DRAFT Order <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Orders List Screen */
        <div>
          <div className="card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Filter by Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
                style={{ padding: "0.4rem 0.8rem" }}
              >
                <option value="">All Orders</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <button onClick={fetchOrders} className="btn-secondary" style={{ padding: "0.4rem 0.8rem" }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
              No orders found for the selected status.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {orders.map((o) => {
                const statusBadgeClass = `badge badge-${o.status.toLowerCase()}`;

                return (
                  <div key={o.order_number} className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.6rem" }}>
                      <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--accent-primary)", fontSize: "1.05rem" }}>
                          {o.order_number}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginLeft: "1rem" }}>
                          Created: {new Date(o.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span className={statusBadgeClass}>{o.status}</span>
                        <strong style={{ fontSize: "1.1rem" }}>₹{o.grand_total}</strong>
                      </div>
                    </div>

                    {/* Items table */}
                    <table style={{ width: "100%", fontSize: "0.85rem", marginBottom: "1rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                          <th style={{ padding: "0.3rem" }}>SKU</th>
                          <th style={{ padding: "0.3rem" }}>Name</th>
                          <th style={{ padding: "0.3rem" }}>Qty</th>
                          <th style={{ padding: "0.3rem" }}>Unit Price</th>
                          <th style={{ padding: "0.3rem" }}>Subtotal</th>
                          <th style={{ padding: "0.3rem" }}>18% Tax</th>
                          <th style={{ padding: "0.3rem", textAlign: "right" }}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items?.map((it, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                            <td style={{ padding: "0.4rem", fontFamily: "var(--font-mono)" }}>{it.sku}</td>
                            <td style={{ padding: "0.4rem" }}>{it.name}</td>
                            <td style={{ padding: "0.4rem" }}>{it.quantity}</td>
                            <td style={{ padding: "0.4rem" }}>₹{it.unit_price}</td>
                            <td style={{ padding: "0.4rem" }}>₹{it.line_subtotal}</td>
                            <td style={{ padding: "0.4rem" }}>₹{it.line_tax}</td>
                            <td style={{ padding: "0.4rem", textAlign: "right", fontWeight: "600" }}>₹{it.line_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Action buttons */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                      {o.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => handleAction(o.order_number, "cancel")}
                            className="btn-danger"
                          >
                            <X size={14} /> Cancel
                          </button>
                          <button
                            onClick={() => handleAction(o.order_number, "confirm")}
                            className="btn-primary"
                          >
                            <Check size={14} /> Confirm (Deduct Stock)
                          </button>
                        </>
                      )}

                      {o.status === "CONFIRMED" && (
                        <>
                          <button
                            onClick={() => handleAction(o.order_number, "cancel")}
                            className="btn-danger"
                          >
                            <X size={14} /> Cancel (Restore Stock)
                          </button>
                          <button
                            onClick={() => handleAction(o.order_number, "dispatch")}
                            className="btn-primary"
                          >
                            <Truck size={14} /> Dispatch
                          </button>
                        </>
                      )}

                      {o.status === "DISPATCHED" && (
                        <button
                          onClick={() => handleAction(o.order_number, "deliver")}
                          className="btn-primary"
                        >
                          <Package size={14} /> Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
