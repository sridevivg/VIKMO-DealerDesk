import React, { useState, useEffect } from "react";
import { Search, Filter, ShoppingCart, RefreshCw, AlertCircle, CheckCircle2, PackageCheck } from "lucide-react";

export default function CatalogueView({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [adjustSku, setAdjustSku] = useState(null);
  const [newStock, setNewStock] = useState("");
  const [message, setMessage] = useState(null);

  const categories = [
    "Body & Styling", "Drivetrain", "Lighting & Electrical", "Engine & Oils",
    "Brakes", "Controls & Grips", "Universal Accessories", "Filters",
    "Tyres & Tubes", "Car Care", "Rider Gear"
  ];

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: 12 });
      if (search) params.append("search", search);
      if (category) params.append("category", category);
      if (vehicle) params.append("vehicle", vehicle);

      const res = await fetch(`/api/products/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.results || []);
        setTotalCount(data.count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    if (!adjustSku || newStock === "") return;
    try {
      const res = await fetch(`/api/inventory/${adjustSku}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: parseInt(newStock, 10), reason: "Dealer Portal adjustment" }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Inventory updated for ${adjustSku}` });
        setAdjustSku(null);
        setNewStock("");
        fetchProducts();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err?.error?.message || "Failed to update stock" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error updating stock" });
    }
  };

  return (
    <div className="animate-fade">
      {/* Top Search & Filter Bar */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={18} style={{ position: "absolute", left: "0.8rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search SKU, part name, or brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ width: "100%", paddingLeft: "2.4rem" }}
            />
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="input-field"
              style={{ width: "100%" }}
            >
              <option value="">All Categories ({totalCount})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <input
              type="text"
              placeholder="Vehicle fitment (e.g. Pulsar)..."
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="input-field"
              style={{ width: "100%" }}
            />
          </div>

          <button type="submit" className="btn-primary">
            <Filter size={16} /> Filter
          </button>
        </form>

        {message && (
          <div className={`alert-box ${message.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginTop: "1rem" }}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
          <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 0.75rem auto" }} />
          <div>Loading inventory catalogue...</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {products.map((p) => {
            const isOutOfStock = p.stock === 0;
            const isLowStock = p.stock > 0 && p.stock < 15;

            return (
              <div
                key={p.sku}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8125rem",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {p.sku}
                    </span>
                    <span
                      className={`badge ${
                        isOutOfStock ? "badge-cancelled" : isLowStock ? "badge-draft" : "badge-optimal"
                      }`}
                    >
                      {isOutOfStock ? "Out of Stock" : isLowStock ? `Low: ${p.stock}` : `Stock: ${p.stock}`}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      marginBottom: "0.45rem",
                      color: "var(--text-primary)",
                      lineHeight: "1.35",
                    }}
                  >
                    {p.name}
                  </h3>

                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      marginBottom: "0.6rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Brand:</span>{" "}
                      <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.brand}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Fitment:</span>{" "}
                      <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p.vehicle_fitment}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Category:</span>{" "}
                      <span>{p.category}</span>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-muted)",
                      marginBottom: "1rem",
                      lineHeight: "1.45",
                      maxHeight: "3.2rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {p.description}
                  </p>
                </div>

                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--border-light)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                      Unit Price (excl. GST)
                    </span>
                    <span style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-primary)" }}>
                      ₹{p.price}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.45rem" }}>
                    <button
                      onClick={() => { setAdjustSku(p.sku); setNewStock(p.stock); }}
                      className="btn-secondary"
                      style={{ padding: "0.4rem 0.65rem", fontSize: "0.8125rem" }}
                      title="Adjust Live Warehouse Stock"
                    >
                      <PackageCheck size={14} /> Stock
                    </button>
                    <button
                      onClick={() => onAddToCart(p)}
                      disabled={isOutOfStock}
                      className="btn-primary"
                      style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
                    >
                      <ShoppingCart size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1.5rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border-light)",
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
          Showing page {page} of {Math.ceil(totalCount / 12) || 1} ({totalCount} total items)
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 12 >= totalCount}
            className="btn-secondary"
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem" }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustSku && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: "400px",
              maxWidth: "92%",
              background: "var(--bg-surface)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h3 style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "0.5rem", color: "var(--text-primary)" }}>
              Adjust Stock: <span style={{ fontFamily: "var(--font-mono)" }}>{adjustSku}</span>
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Update available warehouse physical stock quantity for live dealer ordering.
            </p>
            <form onSubmit={handleStockUpdate}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "0.35rem",
                  }}
                >
                  New Available Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setAdjustSku(null)}
                  className="btn-secondary"
                  style={{ fontSize: "0.8125rem" }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: "0.8125rem" }}>
                  Save Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
