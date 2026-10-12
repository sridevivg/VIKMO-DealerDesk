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
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          onClick={() => setActiveTab("cart")}
          className={activeTab === "cart" ? "btn-primary" : "btn-secondary"}
          style={{ fontSize: "0.8125rem", padding: "0.45rem 0.85rem" }}
        >
          <ShoppingCart size={15} /> Active Cart ({cart.length})
        </button>
        <button
          onClick={() => { setActiveTab("orders"); fetchOrders(); }}
          className={activeTab === "orders" ? "btn-primary" : "btn-secondary"}
          style={{ fontSize: "0.8125rem", padding: "0.45rem 0.85rem" }}
        >
          <Package size={15} /> Order History ({orders.length})
        </button>
      </div>

      {/* Notifications */}
      {errorBanner && (
        <div className="alert-box alert-error" style={{ marginBottom: "1.25rem" }}>
          <AlertCircle size={16} />
          <span><strong>Order Error:</strong> {errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="alert-box alert-success" style={{ marginBottom: "1.25rem" }}>
          <Check size={16} />
          <span>{successBanner}</span>
        </div>
      )}

      {activeTab === "cart" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.25rem", alignItems: "start" }}>
          {/* Cart Table */}
          <div className="card">
            <h2 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.75rem", color: "var(--text-primary)" }}>
              Cart Line Items
            </h2>

            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                <ShoppingCart size={32} style={{ margin: "0 auto 0.5rem auto", opacity: 0.35 }} />
                <div>Your cart is currently empty. Browse the catalogue to add parts.</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ padding: "0.6rem 0.75rem" }}>SKU</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Part Description</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Unit Price</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Quantity</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Subtotal</th>
                      <th style={{ padding: "0.6rem 0.75rem", width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => {
                      const lineSub = (parseFloat(item.price) * item.quantity).toFixed(2);
                      return (
                        <tr key={item.sku}>
                          <td style={{ padding: "0.65rem 0.75rem", fontFamily: "var(--font-mono)", fontWeight: "600", fontSize: "0.8125rem" }}>
                            {item.sku}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", fontWeight: "500", fontSize: "0.85rem" }}>
                            {item.name}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", fontSize: "0.85rem" }}>
                            ₹{item.price}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => onUpdateQty(item.sku, parseInt(e.target.value, 10) || 1)}
                              className="input-field"
                              style={{ width: "65px", padding: "0.25rem 0.45rem", textAlign: "center" }}
                            />
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", fontWeight: "600", fontSize: "0.85rem" }}>
                            ₹{lineSub}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", textAlign: "center" }}>
                            <button
                              onClick={() => onRemoveItem(item.sku)}
                              title="Remove item"
                              style={{ color: "var(--text-muted)", padding: "0.2rem" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checkout Panel */}
          <div className="card">
            <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.85rem", color: "var(--text-primary)" }}>
              Order Checkout
            </h3>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: "0.35rem",
                }}
              >
                Select Ordering Dealer
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

            <div
              style={{
                borderTop: "1px solid var(--border-light)",
                paddingTop: "0.85rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem" }}>
                <span style={{ color: "var(--text-muted)" }}>Line Subtotal</span>
                <span style={{ fontWeight: 500 }}>₹{cartSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem" }}>
                <span style={{ color: "var(--text-muted)" }}>GST (18% rounded)</span>
                <span style={{ fontWeight: 500 }}>₹{cartTax.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1rem",
                  fontWeight: "700",
                  color: "var(--text-primary)",
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: "0.6rem",
                  marginTop: "0.4rem",
                }}
              >
                <span>Grand Total</span>
                <span>₹{cartGrandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCreateDraft}
              disabled={cart.length === 0}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Create Draft Order <ChevronRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* Orders List Screen */
        <div>
          <div
            className="card"
            style={{
              marginBottom: "1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 500 }}>
                Status Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
                style={{ padding: "0.35rem 0.65rem" }}
              >
                <option value="">All Orders</option>
                <option value="DRAFT">DRAFT</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <button onClick={fetchOrders} className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8125rem" }}>
              <RefreshCw size={14} /> Refresh Orders
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
              <RefreshCw className="animate-spin" size={20} style={{ margin: "0 auto 0.5rem auto" }} />
              <div>Loading dealer orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
              No orders found for the selected status filter.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {orders.map((o) => {
                const statusBadgeClass = `badge badge-${o.status.toLowerCase()}`;

                return (
                  <div key={o.order_number} className="card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.75rem",
                        borderBottom: "1px solid var(--border-light)",
                        paddingBottom: "0.6rem",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: "700",
                            color: "var(--text-primary)",
                            fontSize: "0.95rem",
                          }}
                        >
                          {o.order_number}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {new Date(o.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <span className={statusBadgeClass}>{o.status}</span>
                        <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>₹{o.grand_total}</strong>
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="table-wrapper" style={{ marginBottom: "0.85rem" }}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ padding: "0.45rem 0.65rem" }}>SKU</th>
                            <th style={{ padding: "0.45rem 0.65rem" }}>Name</th>
                            <th style={{ padding: "0.45rem 0.65rem" }}>Qty</th>
                            <th style={{ padding: "0.45rem 0.65rem" }}>Unit Price</th>
                            <th style={{ padding: "0.45rem 0.65rem" }}>Subtotal</th>
                            <th style={{ padding: "0.45rem 0.65rem" }}>18% Tax</th>
                            <th style={{ padding: "0.45rem 0.65rem", textAlign: "right" }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items?.map((it, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: "0.5rem 0.65rem", fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}>
                                {it.sku}
                              </td>
                              <td style={{ padding: "0.5rem 0.65rem", fontSize: "0.8125rem" }}>{it.name}</td>
                              <td style={{ padding: "0.5rem 0.65rem", fontSize: "0.8125rem" }}>{it.quantity}</td>
                              <td style={{ padding: "0.5rem 0.65rem", fontSize: "0.8125rem" }}>₹{it.unit_price}</td>
                              <td style={{ padding: "0.5rem 0.65rem", fontSize: "0.8125rem" }}>₹{it.line_subtotal}</td>
                              <td style={{ padding: "0.5rem 0.65rem", fontSize: "0.8125rem" }}>₹{it.line_tax}</td>
                              <td style={{ padding: "0.5rem 0.65rem", textAlign: "right", fontWeight: "600", fontSize: "0.8125rem" }}>
                                ₹{it.line_total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      {o.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => handleAction(o.order_number, "cancel")}
                            className="btn-danger"
                          >
                            <X size={14} /> Cancel Order
                          </button>
                          <button
                            onClick={() => handleAction(o.order_number, "confirm")}
                            className="btn-primary"
                          >
                            <Check size={14} /> Confirm Order (Allocate Stock)
                          </button>
                        </>
                      )}

                      {o.status === "CONFIRMED" && (
                        <>
                          <button
                            onClick={() => handleAction(o.order_number, "cancel")}
                            className="btn-danger"
                          >
                            <X size={14} /> Cancel Order (Restore Stock)
                          </button>
                          <button
                            onClick={() => handleAction(o.order_number, "dispatch")}
                            className="btn-primary"
                          >
                            <Truck size={14} /> Dispatch Order
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
