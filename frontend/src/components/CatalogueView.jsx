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
          <div style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: message.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
            color: message.type === "success" ? "var(--success)" : "var(--danger)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-secondary)" }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: "0 auto 1rem auto" }} />
          Loading catalogue items...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {products.map((p) => {
            const isOutOfStock = p.stock === 0;
            const isLowStock = p.stock > 0 && p.stock < 15;

            return (
              <div key={p.sku} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--accent-primary)", fontWeight: "bold" }}>
                      {p.sku}
                    </span>
                    <span className={`badge ${isOutOfStock ? "badge-cancelled" : isLowStock ? "badge-draft" : "badge-confirmed"}`}>
                      {isOutOfStock ? "Out of Stock" : isLowStock ? `Low: ${p.stock}` : `Stock: ${p.stock}`}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "0.4rem", color: "var(--text-primary)" }}>
                    {p.name}
                  </h3>

                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                    <div>Brand: <strong style={{ color: "var(--text-primary)" }}>{p.brand}</strong></div>
                    <div>Fitment: <strong style={{ color: "var(--text-primary)" }}>{p.vehicle_fitment}</strong></div>
                    <div>Category: <em>{p.category}</em></div>
                  </div>

                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: "1.4", maxHeight: "3rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.description}
                  </p>
                </div>

                <div style={{ paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Price (excl. GST)</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-primary)" }}>
                      ₹{p.price}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => { setAdjustSku(p.sku); setNewStock(p.stock); }}
                      className="btn-secondary"
                      style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}
                      title="Adjust Live Warehouse Stock"
                    >
                      <PackageCheck size={14} /> Stock
                    </button>
                    <button
                      onClick={() => onAddToCart(p)}
                      disabled={isOutOfStock}
                      className="btn-primary"
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", opacity: isOutOfStock ? 0.5 : 1 }}
                    >
                      <ShoppingCart size={15} /> Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Showing page {page} of {Math.ceil(totalCount / 12) || 1} ({totalCount} parts)
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 12 >= totalCount}
            className="btn-secondary"
          >
            Next
          </button>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustSku && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div className="card" style={{ width: "380px", maxWidth: "90%", background: "var(--bg-secondary)" }}>
            <h3 style={{ marginBottom: "1rem", fontWeight: "700" }}>Adjust Stock: {adjustSku}</h3>
            <form onSubmit={handleStockUpdate}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
                  New Warehouse Available Stock Quantity:
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
                <button type="button" onClick={() => setAdjustSku(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
